const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Session = require('../models/Session');
const SessionTransaction = require('../models/SessionTransaction');
const sequelize = require('../config/database');
const { Op, Transaction } = require('sequelize');
const { logActivity } = require('./ActivityLogController');
const { auditLog } = require('../utils/auditLogger');
const UserDetail = require('../models/UserDetail');
const PrintJob = require('../models/PrintJob');
const OrderItem = require('../models/OrderItem');
const OrderItemModification = require('../models/OrderItemModification');
const ModificationItem = require('../models/ModificationItem');
const Product = require('../models/Product');
const Variation = require('../models/Variation');
const Branch = require('../models/Branch');
const templateService = require('../services/templateService');
const {
    trySettleExistingPendingPayment,
    wouldDoubleCoverOrder,
    syncBalanceDuePayment,
    persistOrderPaymentAggregate,
    deriveAggregatePaymentStatus,
    PAYMENT_LIST_ATTRIBUTES,
    attachDerivedPaymentFieldsToOrderJson,
} = require('../utils/orderPaymentState');

async function jsonPaymentWithOrderSummary(orderId, paymentRecord, res, statusCode) {
    const orderWithPayments = await Order.findByPk(orderId, {
        include: [{ model: Payment, as: 'payments', attributes: PAYMENT_LIST_ATTRIBUTES }],
    });
    const summary = orderWithPayments
        ? attachDerivedPaymentFieldsToOrderJson(orderWithPayments.toJSON())
        : { balanceDue: null, paymentStatus: null };
    return res.status(statusCode).json({
        ...paymentRecord.toJSON(),
        balanceDue: summary.balanceDue,
        paymentStatus: summary.paymentStatus,
    });
}

const applyBranchFilter = async (req, whereClause) => {
    if (req.user && req.user.role !== 'admin') {
        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        if (userDetail) {
            const usersInBranch = await UserDetail.findAll({
                where: { branchId: userDetail.branchId },
                attributes: ['userId']
            });
            whereClause.userId = { [Op.in]: usersInBranch.map(u => u.userId) };
        } else {
            whereClause.userId = req.user.id;
        }
    }
    return whereClause;
};


exports.createPayment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { orderId, paymentMethod, amount, transactionId, status } = req.body;

        if (!orderId || !paymentMethod || amount === undefined || amount === null) {
            await t.rollback();
            return res.status(400).json({ message: 'Order ID, payment method, and amount are required' });
        }

        const amountNum = parseFloat(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
            await t.rollback();
            return res.status(400).json({ message: 'Amount must be a positive number' });
        }

        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        const effectiveStatus = status || 'pending';

        if (effectiveStatus === 'paid') {
            const settled = await trySettleExistingPendingPayment({
                orderId,
                paymentMethod,
                amount: amountNum,
                transactionId,
                userId: req.user?.id,
                transaction: t,
            });

            let paymentRecord = settled.settled ? settled.payment : null;

            if (!settled.settled) {
                const existing = await Payment.findAll({ where: { orderId }, transaction: t });
                if (wouldDoubleCoverOrder(order.totalAmount, existing, amountNum)) {
                    await t.rollback();
                    return res.status(409).json({
                        message:
                            'This payment would over-cover the order (possible duplicate charge). POST the same amount as an open pending line to settle it, or verify balanceDue on the order.',
                    });
                }
                paymentRecord = await Payment.create(
                    {
                        orderId,
                        paymentMethod,
                        amount: amountNum,
                        transactionId,
                        status: 'paid',
                        userId: req.user?.id,
                        paymentRole: 'sale',
                    },
                    { transaction: t }
                );
            }

            await syncBalanceDuePayment(orderId, order.totalAmount, t);
            await persistOrderPaymentAggregate(orderId, t);

            if (paymentMethod === 'cash') {
                const session = await Session.findOne({
                    where: { userId: req.user?.id, status: 'open' },
                    transaction: t,
                });
                if (session) {
                    const amountFloat = parseFloat(paymentRecord.amount);
                    await session.update(
                        { currentBalance: parseFloat(session.currentBalance) + amountFloat },
                        { transaction: t }
                    );
                    await SessionTransaction.create(
                        {
                            sessionId: session.id,
                            type: 'sale',
                            amount: amountFloat,
                            paymentId: paymentRecord.id,
                            userId: req.user?.id,
                            description: `Cash sale for Order #${orderId}`,
                        },
                        { transaction: t }
                    );
                }
            }

            await t.commit();

            auditLog(settled.settled ? 'payment_settled' : 'payment_created', {
                ip: req.ip,
                userId: req.user.id,
                metadata: {
                    orderId,
                    paymentId: paymentRecord.id,
                    amount: paymentRecord.amount,
                    settledExistingPending: settled.settled,
                },
            });

            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Payment Received',
                description: `Payment of Rs.${paymentRecord.amount} for Order #${orderId} via ${paymentMethod}${settled.settled ? ' (settled pending line)' : ''}`,
                orderId,
                amount: paymentRecord.amount,
                metadata: { paymentMethod, transactionId, status: paymentRecord.status, settled: settled.settled },
            });

            if (settled.settled) {
                return jsonPaymentWithOrderSummary(orderId, paymentRecord, res, 200);
            }
            return jsonPaymentWithOrderSummary(orderId, paymentRecord, res, 201);
        }

        const payment = await Payment.create(
            {
                orderId,
                paymentMethod,
                amount: amountNum,
                transactionId,
                status: effectiveStatus,
                userId: req.user?.id,
                paymentRole: 'sale',
            },
            { transaction: t }
        );

        await syncBalanceDuePayment(orderId, order.totalAmount, t);
        await persistOrderPaymentAggregate(orderId, t);

        await t.commit();

        auditLog('payment_created', {
            ip: req.ip,
            userId: req.user.id,
            metadata: { orderId, paymentId: payment.id, amount: payment.amount, status: payment.status },
        });

        // Queue Receipt Print Job after successful payment
        try {
            if (status === 'paid' || !status) {
                const fullOrder = await Order.findByPk(orderId, {
                    include: [
                        { model: Customer, as: 'customer' },
                        {
                            model: OrderItem,
                            as: 'items',
                            include: [
                                { model: Product, as: 'product' },
                                { model: Variation, as: 'variation' },
                                {
                                    model: OrderItemModification,
                                    as: 'modifications',
                                    include: [{ model: ModificationItem, as: 'modification' }]
                                }
                            ]
                        }
                    ]
                });

                const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
                const branchId = userDetail?.branchId || 1;
                const branch = await Branch.findByPk(branchId);
                const content = templateService.generateReceiptHtml(fullOrder, payment, branch);

                await PrintJob.create({
                    orderId: fullOrder.id,
                    paymentId: payment.id,
                    content,
                    type: 'receipt',
                    status: 'pending'
                });
            }
        } catch (printError) {
            console.error('[PaymentController] Failed to queue print job for order', orderId, ':', printError);
            // Don't fail the payment if printing fails
        }

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Payment Recorded',
            description: `Payment line of Rs.${amount} for Order #${orderId} via ${paymentMethod} (${payment.status})`,
            orderId,
            amount,
            metadata: { paymentMethod, transactionId, status: payment.status },
        });

        return jsonPaymentWithOrderSummary(orderId, payment, res, 201);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: error.message });
    }
};

exports.updatePaymentStatus = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { status, is_refund, refund_type, refund_amount } = req.body;

        const payment = await Payment.findByPk(id, { transaction: t });
        if (!payment) {
            await t.rollback();
            return res.status(404).json({ message: 'Payment not found' });
        }

        let finalStatus = payment.status;
        let actualRefundAmount = 0;

        if (is_refund == 1) {
            if (refund_type === 'partial' && refund_amount > 0) {
                actualRefundAmount = parseFloat(refund_amount);
                finalStatus = 'partial_refund';
            } else {
                actualRefundAmount = parseFloat(payment.amount) - parseFloat(payment.refundedAmount || 0);
                finalStatus = 'refund';
            }

            if (parseFloat(payment.refundedAmount || 0) + actualRefundAmount > parseFloat(payment.amount)) {
                await t.rollback();
                return res.status(400).json({ message: 'Refund amount exceeds payment amount' });
            }
            if (parseFloat(payment.refundedAmount || 0) + actualRefundAmount === parseFloat(payment.amount)) {
                finalStatus = 'refund';
            }
        } else if (status) {
            finalStatus = status;
        }

        const newRefundedAmount = is_refund == 1
            ? parseFloat(payment.refundedAmount || 0) + actualRefundAmount
            : parseFloat(payment.refundedAmount || 0);

        await payment.update({
            status: finalStatus,
            ...(is_refund == 1 && { refundedAmount: newRefundedAmount })
        }, { transaction: t });

        if (payment.paymentMethod === 'cash' && is_refund == 1 && actualRefundAmount > 0) {
            const session = await Session.findOne({
                where: { userId: req.user?.id, status: 'open' },
                transaction: t,
            });

            if (session) {
                await session.update(
                    { currentBalance: parseFloat(session.currentBalance) - actualRefundAmount },
                    { transaction: t }
                );

                await SessionTransaction.create({
                    sessionId: session.id,
                    type: 'refund',
                    amount: actualRefundAmount,
                    paymentId: payment.id,
                    userId: req.user?.id,
                    description: `Refund for Payment #${payment.id} (Order #${payment.orderId}) - ${refund_type === 'partial' ? 'Partial' : 'Full'}`
                }, { transaction: t });
            }
        }

        const orderId = payment.orderId;
        const ord = await Order.findByPk(orderId, { transaction: t });
        await syncBalanceDuePayment(orderId, ord.totalAmount, t);
        await persistOrderPaymentAggregate(orderId, t);

        await t.commit();

        await payment.reload();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: is_refund == 1 ? 'Order Refunded' : 'Payment Updated',
            description: is_refund == 1
                ? `Refund of Rs.${actualRefundAmount} processed for Payment #${id} (Order #${payment.orderId})`
                : `Payment #${id} status updated to ${finalStatus}`,
            orderId: payment.orderId,
            amount: is_refund == 1 ? actualRefundAmount : null,
            metadata: { paymentId: id, status: finalStatus, is_refund, refund_type, actualRefundAmount }
        });
        if (is_refund == 1) {
            auditLog('refund', { ip: req.ip, userId: req.user.id, metadata: { paymentId: id, orderId: payment.orderId, amount: actualRefundAmount } });
        } else {
            auditLog('payment_status_updated', {
                ip: req.ip,
                userId: req.user.id,
                metadata: { paymentId: id, orderId: payment.orderId, status: finalStatus },
            });
        }

        res.json({ message: 'Payment status updated', payment });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: error.message });
    }
};

exports.getPaymentsByOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const payments = await Payment.findAll({ where: { orderId } });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllPaymentDetails = async (req, res) => {
    try {
        let where = {};
        where = await applyBranchFilter(req, where);

        const orders = await Order.findAll({
            where,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: PAYMENT_LIST_ATTRIBUTES,
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map((order) => {
            const payments = order.payments || [];
            const primary = payments.find((p) => p.status !== 'refund') || payments[0] || null;
            const refundedSum = payments.reduce((s, p) => s + (parseFloat(p.refundedAmount) || 0), 0);
            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: primary ? primary.paymentMethod : null,
                paymentStatus: deriveAggregatePaymentStatus(order.totalAmount, payments),
                amount: order.totalAmount,
                refundedAmount: refundedSum,
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.searchPaymentDetails = async (req, res) => {
    try {
        const { query } = req.query;
        let where = {};
        where = await applyBranchFilter(req, where);

        if (query) {
            where = {
                [Op.or]: [
                    { id: { [Op.like]: `%${query}%` } },
                    { '$customer.name$': { [Op.like]: `%${query}%` } },
                    { '$customer.mobile$': { [Op.like]: `%${query}%` } }
                ]
            };
        }

        const orders = await Order.findAll({
            where,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: PAYMENT_LIST_ATTRIBUTES,
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map((order) => {
            const payments = order.payments || [];
            const primary = payments.find((p) => p.status !== 'refund') || payments[0] || null;
            const refundedSum = payments.reduce((s, p) => s + (parseFloat(p.refundedAmount) || 0), 0);
            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: primary ? primary.paymentMethod : null,
                paymentStatus: deriveAggregatePaymentStatus(order.totalAmount, payments),
                amount: order.totalAmount,
                refundedAmount: refundedSum,
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.filterPaymentsByStatus = async (req, res) => {
    try {
        const { status } = req.query;

        let where = {};
        where = await applyBranchFilter(req, where);

        const orders = await Order.findAll({
            where,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: PAYMENT_LIST_ATTRIBUTES,
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map((order) => {
            const payments = order.payments || [];
            const primary = payments.find((p) => p.status !== 'refund') || payments[0] || null;
            const refundedSum = payments.reduce((s, p) => s + (parseFloat(p.refundedAmount) || 0), 0);
            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: primary ? primary.paymentMethod : null,
                paymentStatus: deriveAggregatePaymentStatus(order.totalAmount, payments),
                amount: order.totalAmount,
                refundedAmount: refundedSum,
            };
        });

        let filteredResult = result;
        if (status) {
            filteredResult = result.filter(
                (item) => item.paymentStatus.toLowerCase() === status.toLowerCase()
            );
        }

        res.json(filteredResult);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getPaymentStats = async (req, res) => {
    try {
        let where = {};
        where = await applyBranchFilter(req, where);
        const payments = await Payment.findAll({ where });

        let totalCollectedAmount = 0;
        let pendingPaymentAmount = 0;
        let totalRefundAmount = 0;

        payments.forEach(payment => {
            const amount = parseFloat(payment.amount) || 0;
            const refundedAmount = parseFloat(payment.refundedAmount) || 0;

            if (payment.status === 'pending') {
                pendingPaymentAmount += amount;
            } else if (['paid', 'partial_refund', 'refund'].includes(payment.status)) {
                totalCollectedAmount += amount;
                totalRefundAmount += refundedAmount;
            }
        });

        const refundRate = totalCollectedAmount > 0
            ? ((totalRefundAmount / totalCollectedAmount) * 100).toFixed(2)
            : 0;

        res.json({
            totalCollectedAmount,
            pendingPaymentAmount,
            totalRefundAmount,
            refundRate: `${refundRate}%`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
