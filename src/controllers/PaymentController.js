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
const User = require('../models/User');
const PrintJob = require('../models/PrintJob');
const OrderItem = require('../models/OrderItem');
const OrderItemModification = require('../models/OrderItemModification');
const ModificationItem = require('../models/ModificationItem');
const Product = require('../models/Product');
const Variation = require('../models/Variation');
const VariationOption = require('../models/VariationOption');
const Branch = require('../models/Branch');
const templateService = require('../services/templateService');
const { roundMoney } = require('../utils/orderTotals');
const { resolveOrderBranchWhereClause, orderBelongsToRequesterBranch } = require('../utils/orderBranchScope');
const {
    trySettleExistingPendingPayment,
    wouldDoubleCoverOrder,
    reconcileOrderTotalAgainstLineItems,
    removeStaleBalanceDueRowsIfFullyPaid,
    syncBalanceDuePayment,
    persistOrderPaymentAggregate,
    deriveAggregatePaymentStatus,
    resolveOrderTotalForBalanceFromOrderLike,
    PAYMENT_LIST_ATTRIBUTES,
    orderItemsForBalanceInclude,
    attachDerivedPaymentFieldsToOrderJson,
    normalizeStoredPaymentStatus,
    normalizePaymentRole,
    getTolerance,
    computeOutstandingCents,
    getOutstandingToleranceCents,
    sumNetCollected,
} = require('../utils/orderPaymentState');

/**
 * Single payment row for clients. Line settlement is `status` / `linePaymentStatus`.
 */
function formatPaymentRowForClient(p) {
    const row = typeof p.toJSON === 'function' ? p.toJSON() : { ...p };
    const status = row.status;
    const role = row.paymentRole ?? row.payment_role;
    return {
        ...row,
        linePaymentStatus: status,
        line_payment_status: status,
        paymentRole: role,
        payment_role: role,
        orderId: row.orderId ?? row.order_id,
        order_id: row.orderId ?? row.order_id,
        amount: row.amount != null ? Number(row.amount) : row.amount,
        refundedAmount: row.refundedAmount != null ? Number(row.refundedAmount) : Number(row.refunded_amount) || 0,
        refunded_amount: row.refundedAmount != null ? Number(row.refundedAmount) : Number(row.refunded_amount) || 0,
        paymentMethod: row.paymentMethod ?? row.payment_method,
        payment_method: row.paymentMethod ?? row.payment_method,
        paidAmount: row.paidAmount != null ? Number(row.paidAmount) : Number(row.paid_amount) || null,
        paid_amount: row.paidAmount != null ? Number(row.paidAmount) : Number(row.paid_amount) || null,
    };
}

function isRefundBodyFlag(val) {
    return val === 1 || val === '1' || val === true || val === 'true';
}

function logPaymentConsistency(event, data) {
    if (!['1', 'true', 'yes'].includes(String(process.env.LOG_PAYMENT_CONSISTENCY || '').toLowerCase())) {
        return;
    }
    console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

async function queueReceiptPrintJob(orderId, paymentRecord, requestedStatus, userId) {
    try {
        if (requestedStatus === 'paid' || !requestedStatus) {
            const fullOrder = await Order.findByPk(orderId, {
                include: [
                    { model: Customer, as: 'customer' },
                    { model: User, as: 'user' },
                    {
                        model: OrderItem,
                        as: 'items',
                        include: [
                            { model: Product, as: 'product' },
                            {
                                model: VariationOption,
                                as: 'variationOption',
                                include: [{ model: Variation, as: 'Variation' }]
                            },
                            {
                                model: OrderItemModification,
                                as: 'modifications',
                                include: [{ model: ModificationItem, as: 'modification' }]
                            }
                        ]
                    }
                ]
            });

            if (!fullOrder) return;

            const userDetail = await UserDetail.findOne({ where: { userId } });
            const branchId = userDetail?.branchId || 1;
            const branch = await Branch.findByPk(branchId);

            if (fullOrder.user && userDetail) {
                fullOrder.user.name = userDetail.name;
            }

            const data = templateService.generateReceiptStructuredData(fullOrder, paymentRecord, branch);
            const content = JSON.stringify(data);
            await PrintJob.create({
                order_id: fullOrder.id,
                payment_id: paymentRecord.id,
                printer_name: 'XP-80',
                content,
                type: 'receipt',
                status: 'pending'
            });
        }
    } catch (printError) {
        console.error('[PaymentController] Failed to queue print job for order', orderId, ':', printError);
    }
}

/**
 * Same derivation as GET /orders (attachDerived). Includes DB column before derive for debugging drift.
 * Call only after the transaction that updated payments + persistOrderPaymentAggregate has committed.
 * (attachDerived keeps orders.paymentStatus from DB on read.)
 */
function buildOrderPaymentSnapshot(orderWithPayments) {
    if (!orderWithPayments) {
        return {
            orderId: null,
            orderTotalAmount: null,
            order_total_amount: null,
            orderPaymentStatus: null,
            order_payment_status: null,
            paymentStatus: null,
            payment_status: null,
            balanceDue: null,
            balance_due: null,
            requiresAdditionalPayment: null,
            requires_additional_payment: null,
            totalRefundedOnOrder: null,
            total_refunded_on_order: null,
            orderDbPaymentStatus: null,
            order_db_payment_status: null,
        };
    }
    const plain = orderWithPayments.get({ plain: true });
    const dbPaymentStatus = plain.paymentStatus;
    attachDerivedPaymentFieldsToOrderJson(plain);
    const payments = plain.payments || [];
    const totalRefundedOnOrder = roundMoney(
        payments.reduce((s, p) => s + (parseFloat(p.refundedAmount) || 0), 0)
    );
    return {
        orderId: plain.id,
        orderTotalAmount: plain.totalAmount != null ? Number(plain.totalAmount) : null,
        order_total_amount: plain.totalAmount != null ? Number(plain.totalAmount) : null,
        orderPaymentStatus: plain.paymentStatus,
        order_payment_status: plain.paymentStatus,
        paymentStatus: plain.paymentStatus,
        payment_status: plain.paymentStatus,
        balanceDue: plain.balanceDue,
        balance_due: plain.balanceDue,
        requiresAdditionalPayment: plain.requiresAdditionalPayment,
        requires_additional_payment: plain.requires_additional_payment,
        totalRefundedOnOrder,
        total_refunded_on_order: totalRefundedOnOrder,
        orderDbPaymentStatus: dbPaymentStatus,
        order_db_payment_status: dbPaymentStatus,
    };
}

async function jsonPaymentWithOrderSummary(orderId, paymentRecord, res, statusCode) {
    const orderWithPayments = await Order.findByPk(orderId, {
        include: [
            { model: Payment, as: 'payments', attributes: PAYMENT_LIST_ATTRIBUTES },
            orderItemsForBalanceInclude,
        ],
    });
    const snapshot = buildOrderPaymentSnapshot(orderWithPayments);
    logPaymentConsistency('payment_create_read_after_commit', {
        orderId,
        derivedPaymentStatus: snapshot.orderPaymentStatus,
        dbPaymentStatus: snapshot.orderDbPaymentStatus,
    });
    return res.status(statusCode).json({
        ...formatPaymentRowForClient(paymentRecord),
        ...snapshot,
    });
}

exports.createPayment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { orderId, paymentMethod, amount, transactionId, status, paidAmount } = req.body;
        const rawPaidAmount = paidAmount ?? req.body.paid_amount;
        const rawPaymentRole = req.body.paymentRole ?? req.body.payment_role;
        const clientPaymentRole =
            rawPaymentRole !== undefined && rawPaymentRole !== null && String(rawPaymentRole).trim() !== ''
                ? normalizePaymentRole(rawPaymentRole)
                : null;

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
            include: [orderItemsForBalanceInclude],
        });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }
        if (!(await orderBelongsToRequesterBranch(req, order))) {
            await t.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        const effectiveStatus = status || 'pending';

        if (effectiveStatus === 'paid') {
            await reconcileOrderTotalAgainstLineItems(order, t);
            await syncBalanceDuePayment(orderId, t);
            await order.reload({
                transaction: t,
                include: [orderItemsForBalanceInclude],
            });

            let settled = await trySettleExistingPendingPayment({
                orderId,
                paymentMethod,
                amount: amountNum,
                transactionId,
                userId: req.user?.id,
                transaction: t,
            });

            if (!settled.settled) {
                await order.reload({
                    transaction: t,
                    include: [orderItemsForBalanceInclude],
                });
                await reconcileOrderTotalAgainstLineItems(order, t);
                const clearedStaleBd = await removeStaleBalanceDueRowsIfFullyPaid(orderId, order, t);
                if (clearedStaleBd) {
                    await syncBalanceDuePayment(orderId, t);
                    await order.reload({
                        transaction: t,
                        include: [orderItemsForBalanceInclude],
                    });
                    settled = await trySettleExistingPendingPayment({
                        orderId,
                        paymentMethod,
                        amount: amountNum,
                        transactionId,
                        userId: req.user?.id,
                        transaction: t,
                    });
                }
            }

            let paymentRecord = settled.settled ? settled.payment : null;

            if (!settled.settled) {
                if (clientPaymentRole === 'balance_due') {
                    await t.rollback();
                    return res.status(400).json({
                        message:
                            'No pending balance-due line matches this amount. Save the order first, then pay exactly the additional amount (see GET order balanceDue or pending balance_due payment row).',
                    });
                }
                const existing = await Payment.findAll({ where: { orderId }, transaction: t });
                if (wouldDoubleCoverOrder(order.totalAmount, existing, amountNum)) {
                    await t.rollback();
                    const orderTotalAmt = roundMoney(parseFloat(order.totalAmount) || 0);
                    const netBefore = sumNetCollected(existing);
                    return res.status(409).json({
                        message:
                            'This payment would over-cover the order (possible duplicate charge). Use order.totalAmount from the API for the charge amount, or POST the same amount as an open pending line to settle it.',
                        orderTotalAmount: orderTotalAmt,
                        order_total_amount: orderTotalAmt,
                        paymentAmount: amountNum,
                        payment_amount: amountNum,
                        netCollectedBeforeThisPayment: netBefore,
                        net_collected_before_this_payment: netBefore,
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
                        paidAmount: rawPaidAmount !== undefined ? parseFloat(rawPaidAmount) : amountNum,
                    },
                    { transaction: t }
                );
            }

            await syncBalanceDuePayment(orderId, t);
            await persistOrderPaymentAggregate(orderId, t);

            const logUnderpay =
                process.env.NODE_ENV !== 'production' ||
                ['1', 'true', 'yes'].includes(String(process.env.LOG_PAY_UNDERPAY || '').toLowerCase());
            if (logUnderpay) {
                await order.reload({ attributes: ['id', 'totalAmount', 'status'], transaction: t });
                const pays = await Payment.findAll({ where: { orderId }, transaction: t });
                const fin = resolveOrderTotalForBalanceFromOrderLike(order);
                const oc = computeOutstandingCents(fin, pays);
                const tolC = getOutstandingToleranceCents(fin);
                if (oc > tolC) {
                    console.warn('[payments] Paid capture but order still owes (check amount vs order.totalAmount / tax)', {
                        orderId,
                        orderTotal: fin,
                        rawOutstandingCents: oc,
                        toleranceCents: tolC,
                        paymentRows: pays.map((p) => ({
                            id: p.id,
                            amount: p.amount,
                            status: p.status,
                            role: p.paymentRole,
                        })),
                    });
                }
            }

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

            await queueReceiptPrintJob(orderId, paymentRecord, status, req.user.id);

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
                paymentRole: clientPaymentRole === 'balance_due' ? 'balance_due' : 'sale',
                paidAmount: rawPaidAmount !== undefined ? parseFloat(rawPaidAmount) : amountNum,
            },
            { transaction: t }
        );

        await syncBalanceDuePayment(orderId, t);
        await persistOrderPaymentAggregate(orderId, t);

        await t.commit();

        auditLog('payment_created', {
            ip: req.ip,
            userId: req.user.id,
            metadata: { orderId, paymentId: payment.id, amount: payment.amount, status: payment.status },
        });

        await queueReceiptPrintJob(orderId, payment, status, req.user.id);

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

        const payment = await Payment.findByPk(id, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!payment) {
            await t.rollback();
            return res.status(404).json({ message: 'Payment not found' });
        }

        const orderForScope = await Order.findByPk(payment.orderId, { transaction: t });
        if (!orderForScope || !(await orderBelongsToRequesterBranch(req, orderForScope))) {
            await t.rollback();
            return res.status(404).json({ message: 'Payment not found' });
        }

        const isRefund = isRefundBodyFlag(is_refund);
        let finalStatus = payment.status;
        let actualRefundAmount = 0;

        if (isRefund) {
            if (normalizePaymentRole(payment.paymentRole) === 'balance_due') {
                await t.rollback();
                return res.status(400).json({
                    message:
                        'Cannot refund a balance-due line. Refund the main sale payment (paymentRole sale, status paid).',
                });
            }

            if (payment.status === 'pending') {
                await t.rollback();
                return res.status(400).json({ message: 'Cannot refund a pending payment; it is not settled yet.' });
            }

            const paidSoFar = parseFloat(payment.amount) || 0;
            const alreadyRefunded = parseFloat(payment.refundedAmount || 0) || 0;
            const remainingRefundable = roundMoney(paidSoFar - alreadyRefunded);
            const tol = getTolerance();

            if (payment.status === 'refund' && remainingRefundable <= tol) {
                await t.rollback();
                return res.status(400).json({ message: 'This payment is already fully refunded.' });
            }

            const rt = refund_type != null ? String(refund_type).toLowerCase().trim() : 'full';

            if (rt === 'partial') {
                actualRefundAmount = parseFloat(refund_amount);
                if (!Number.isFinite(actualRefundAmount) || actualRefundAmount <= 0) {
                    await t.rollback();
                    return res.status(400).json({
                        message: 'Partial refund requires refund_amount as a positive number.',
                    });
                }
                if (actualRefundAmount > remainingRefundable + tol) {
                    await t.rollback();
                    return res.status(400).json({
                        message: `Refund amount exceeds remaining refundable amount (${remainingRefundable.toFixed(2)}).`,
                    });
                }
                finalStatus =
                    alreadyRefunded + actualRefundAmount >= paidSoFar - tol ? 'refund' : 'partial_refund';
            } else {
                actualRefundAmount = remainingRefundable;
                if (actualRefundAmount <= tol) {
                    await t.rollback();
                    return res.status(400).json({ message: 'Nothing left to refund on this payment.' });
                }
                finalStatus = 'refund';
            }

            if (alreadyRefunded + actualRefundAmount > paidSoFar + tol) {
                await t.rollback();
                return res.status(400).json({ message: 'Refund amount exceeds payment amount.' });
            }
        } else if (status) {
            finalStatus = status;
        }

        const newRefundedAmount = isRefund
            ? parseFloat(payment.refundedAmount || 0) + actualRefundAmount
            : parseFloat(payment.refundedAmount || 0);

        await payment.update({
            status: finalStatus,
            ...(isRefund && { refundedAmount: newRefundedAmount })
        }, { transaction: t });

        if (payment.paymentMethod === 'cash' && isRefund && actualRefundAmount > 0) {
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
        if (!ord) {
            await t.rollback();
            return res.status(404).json({ message: 'Order not found for this payment' });
        }
        await syncBalanceDuePayment(orderId, t);
        await persistOrderPaymentAggregate(orderId, t);

        await t.commit();

        await payment.reload();

        const orderWithPayments = await Order.findByPk(orderId, {
            include: [
                { model: Payment, as: 'payments', attributes: PAYMENT_LIST_ATTRIBUTES },
                orderItemsForBalanceInclude,
            ],
        });
        const snapshot = buildOrderPaymentSnapshot(orderWithPayments);
        logPaymentConsistency('payment_status_update_read_after_commit', {
            orderId,
            derivedPaymentStatus: snapshot.orderPaymentStatus,
            dbPaymentStatus: snapshot.orderDbPaymentStatus,
            totalAmount: snapshot.orderTotalAmount,
        });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: isRefund ? 'Order Refunded' : 'Payment Updated',
            description: isRefund
                ? `Refund of Rs.${actualRefundAmount} processed for Payment #${id} (Order #${payment.orderId})`
                : `Payment #${id} status updated to ${finalStatus}`,
            orderId: payment.orderId,
            amount: isRefund ? actualRefundAmount : null,
            metadata: { paymentId: id, status: finalStatus, is_refund, refund_type, actualRefundAmount }
        });
        if (isRefund) {
            auditLog('refund', { ip: req.ip, userId: req.user.id, metadata: { paymentId: id, orderId: payment.orderId, amount: actualRefundAmount } });
        } else {
            auditLog('payment_status_updated', {
                ip: req.ip,
                userId: req.user.id,
                metadata: { paymentId: id, orderId: payment.orderId, status: finalStatus },
            });
        }

        res.json({
            message: 'Payment status updated',
            payment: formatPaymentRowForClient(payment),
            refundAmountThisRequest: isRefund ? roundMoney(actualRefundAmount) : undefined,
            refund_amount_this_request: isRefund ? roundMoney(actualRefundAmount) : undefined,
            ...snapshot,
        });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: error.message });
    }
};

exports.getPaymentsByOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const oid = parseInt(orderId, 10);
        if (!Number.isFinite(oid) || oid < 1) {
            return res.status(400).json({ message: 'Invalid order id' });
        }

        const branchWhere = await resolveOrderBranchWhereClause(req);
        const whereOrder = { [Op.and]: [branchWhere, { id: oid }] };
        const order = await Order.findOne({ where: whereOrder });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const payments = await Payment.findAll({
            where: { orderId: oid },
            order: [['id', 'ASC']],
        });

        const rows = payments.map((p) => formatPaymentRowForClient(p));
        const legacy = ['1', 'true', 'yes'].includes(String(req.query.legacy ?? '').toLowerCase());
        if (legacy) {
            if (req.query.wrap === '1' || req.query.wrap === 'true') {
                return res.json({ data: rows });
            }
            return res.json(rows);
        }

        const envelope = {
            orderId: oid,
            orderPaymentStatus: order.paymentStatus,
            order_payment_status: order.paymentStatus,
            paymentStatus: order.paymentStatus,
            payment_status: order.paymentStatus,
            payments: rows,
        };
        if (req.query.wrap === '1' || req.query.wrap === 'true') {
            return res.json({ data: envelope });
        }
        return res.json(envelope);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllPaymentDetails = async (req, res) => {
    try {
        const where = await resolveOrderBranchWhereClause(req);

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
                },
                orderItemsForBalanceInclude,
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map((order) => {
            const payments = order.payments || [];
            const primary = payments.find((p) => p.status !== 'refund') || payments[0] || null;
            const refundedSum = payments.reduce((s, p) => s + (parseFloat(p.refundedAmount) || 0), 0);
            const plain = order.get({ plain: true });
            const totalForAgg = resolveOrderTotalForBalanceFromOrderLike(plain);
            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: primary ? primary.paymentMethod : null,
                paymentStatus:
                    normalizeStoredPaymentStatus(order.paymentStatus) ??
                    deriveAggregatePaymentStatus(totalForAgg, payments),
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
        const branchWhere = await resolveOrderBranchWhereClause(req);

        const where = query
            ? {
                [Op.and]: [
                    branchWhere,
                    {
                        [Op.or]: [
                            { id: { [Op.like]: `%${query}%` } },
                            { '$customer.name$': { [Op.like]: `%${query}%` } },
                            { '$customer.mobile$': { [Op.like]: `%${query}%` } },
                        ],
                    },
                ],
            }
            : branchWhere;

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
                },
                orderItemsForBalanceInclude,
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map((order) => {
            const payments = order.payments || [];
            const primary = payments.find((p) => p.status !== 'refund') || payments[0] || null;
            const refundedSum = payments.reduce((s, p) => s + (parseFloat(p.refundedAmount) || 0), 0);
            const plain = order.get({ plain: true });
            const totalForAgg = resolveOrderTotalForBalanceFromOrderLike(plain);
            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: primary ? primary.paymentMethod : null,
                paymentStatus:
                    normalizeStoredPaymentStatus(order.paymentStatus) ??
                    deriveAggregatePaymentStatus(totalForAgg, payments),
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

        const where = await resolveOrderBranchWhereClause(req);

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
                },
                orderItemsForBalanceInclude,
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map((order) => {
            const payments = order.payments || [];
            const primary = payments.find((p) => p.status !== 'refund') || payments[0] || null;
            const refundedSum = payments.reduce((s, p) => s + (parseFloat(p.refundedAmount) || 0), 0);
            const plain = order.get({ plain: true });
            const totalForAgg = resolveOrderTotalForBalanceFromOrderLike(plain);
            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: primary ? primary.paymentMethod : null,
                paymentStatus:
                    normalizeStoredPaymentStatus(order.paymentStatus) ??
                    deriveAggregatePaymentStatus(totalForAgg, payments),
                amount: order.totalAmount,
                refundedAmount: refundedSum,
            };
        });

        let filteredResult = result;
        if (status) {
            filteredResult = result.filter(
                (item) =>
                    String(item.paymentStatus || '')
                        .toLowerCase()
                        .trim() === String(status).toLowerCase().trim()
            );
        }

        res.json(filteredResult);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getPaymentStats = async (req, res) => {
    try {
        const branchWhere = await resolveOrderBranchWhereClause(req);
        const orderRows = await Order.findAll({
            where: branchWhere,
            attributes: ['id'],
            raw: true,
        });
        const orderIds = orderRows.map((o) => o.id);
        if (orderIds.length === 0) {
            return res.json({
                totalCollectedAmount: 0,
                pendingPaymentAmount: 0,
                totalRefundAmount: 0,
                refundRate: '0%',
            });
        }
        const payments = await Payment.findAll({ where: { orderId: { [Op.in]: orderIds } } });

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
