const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Session = require('../models/Session');
const SessionTransaction = require('../models/SessionTransaction');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { logActivity } = require('./ActivityLogController');
const { auditLog } = require('../utils/auditLogger');
const UserDetail = require('../models/UserDetail');

exports.createPayment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { orderId, paymentMethod, amount, transactionId, status } = req.body;

        if (!orderId || !paymentMethod || !amount) {
            return res.status(400).json({ message: 'Order ID, payment method, and amount are required' });
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const payment = await Payment.create({
            orderId,
            paymentMethod,
            amount,
            transactionId,
            status: status || 'pending',
            userId: req.user?.id
        }, { transaction: t });

        // if (status === 'paid') {
        //     await order.update({ status: 'complete' }, { transaction: t });
        // }

        // Session integration for cash payments
        if (paymentMethod === 'cash' && (status === 'paid' || !status)) {
            const session = await Session.findOne({
                where: {
                    userId: req.user?.id,
                    status: 'open'
                }
            });

            if (session) {
                const amountFloat = parseFloat(amount);
                await session.update({
                    currentBalance: parseFloat(session.currentBalance) + amountFloat
                }, { transaction: t });

                await SessionTransaction.create({
                    sessionId: session.id,
                    type: 'sale',
                    amount: amountFloat,
                    paymentId: payment.id,
                    userId: req.user?.id,
                    description: `Cash sale for Order #${orderId}`
                }, { transaction: t });
            }
        }

        await t.commit();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Payment Received',
            description: `Payment of Rs.${amount} received for Order #${orderId} via ${paymentMethod}`,
            orderId,
            amount,
            metadata: { paymentMethod, transactionId, status: payment.status }
        });

        res.status(201).json(payment);
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

        const payment = await Payment.findByPk(id);
        if (!payment) {
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

        // Session integration for cash refunds
        if (payment.paymentMethod === 'cash' && is_refund == 1 && actualRefundAmount > 0) {
            const session = await Session.findOne({
                where: {
                    userId: req.user?.id,
                    status: 'open'
                }
            });

            if (session) {
                await session.update({
                    currentBalance: parseFloat(session.currentBalance) - actualRefundAmount
                });

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

        await t.commit();

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
        const orders = await Order.findAll({
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['paymentMethod', 'status']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map(order => {
            const validPayment = order.payments && order.payments.length > 0
                ? (order.payments.find(p => p.status !== 'refund') || order.payments[0])
                : null;

            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: validPayment ? validPayment.paymentMethod : null,
                paymentStatus: validPayment ? validPayment.status : 'Pending',
                amount: order.totalAmount,
                refundedAmount: validPayment ? validPayment.refundedAmount : 0,
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
                    attributes: ['paymentMethod', 'status']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map(order => {
            const validPayment = order.payments && order.payments.length > 0
                ? (order.payments.find(p => p.status !== 'refund') || order.payments[0])
                : null;

            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: validPayment ? validPayment.paymentMethod : null,
                paymentStatus: validPayment ? validPayment.status : 'Pending',
                amount: order.totalAmount,
                refundedAmount: validPayment ? validPayment.refundedAmount : 0,
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

        const orders = await Order.findAll({
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['paymentMethod', 'status']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map(order => {
            const validPayment = order.payments && order.payments.length > 0
                ? (order.payments.find(p => p.status !== 'refund') || order.payments[0])
                : null;

            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: validPayment ? validPayment.paymentMethod : null,
                paymentStatus: validPayment ? validPayment.status : 'Pending',
                amount: order.totalAmount,
                refundedAmount: validPayment ? validPayment.refundedAmount : 0,
            };
        });

        // Filter by status if provided
        let filteredResult = result;
        if (status) {
            filteredResult = result.filter(item =>
                item.paymentStatus.toLowerCase() === status.toLowerCase()
            );
        }

        res.json(filteredResult);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getPaymentStats = async (req, res) => {
    try {
        const payments = await Payment.findAll();

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
