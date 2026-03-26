// Order payment aggregates: env ORDER_MONEY_TOLERANCE (default 0.02), balance_due pending rows, idempotent settle on POST /payments.

const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { roundMoney, amountsRoughlyEqual } = require('./orderTotals');

const DEFAULT_TOLERANCE = 0.02;

const PAYMENT_LIST_ATTRIBUTES = [
    'id',
    'status',
    'amount',
    'paymentMethod',
    'refundedAmount',
    'paymentRole',
    'transactionId',
    'createdAt',
];

function getTolerance() {
    const t = parseFloat(process.env.ORDER_MONEY_TOLERANCE);
    return Number.isFinite(t) && t >= 0 ? t : DEFAULT_TOLERANCE;
}

function normalizePaymentRole(role) {
    if (role === 'balance_due') return 'balance_due';
    return 'sale';
}

function toPlainPayments(payments) {
    return (payments || []).map((p) => (typeof p.toJSON === 'function' ? p.toJSON() : { ...p }));
}

function effectiveCollected(p) {
    const plain = typeof p.toJSON === 'function' ? p.toJSON() : p;
    const amount = parseFloat(plain.amount) || 0;
    const refunded = parseFloat(plain.refundedAmount) || 0;
    const status = plain.status;
    if (status === 'pending') return 0;
    if (status === 'paid' || status === 'partial_refund' || status === 'refund') {
        return Math.max(0, roundMoney(amount - refunded));
    }
    return 0;
}

function sumNetCollected(payments) {
    return roundMoney((payments || []).reduce((sum, p) => sum + effectiveCollected(p), 0));
}

function computeOutstanding(orderTotal, payments) {
    const total = roundMoney(parseFloat(orderTotal) || 0);
    const net = sumNetCollected(payments);
    return Math.max(0, roundMoney(total - net));
}

function deriveCancelledAggregatePaymentStatus(payments) {
    const list = toPlainPayments(payments);
    const tol = getTolerance();
    if (list.length === 0) return 'paid';
    const net = sumNetCollected(list);
    const hadTender = list.some((p) =>
        ['paid', 'partial_refund', 'refund'].includes(p.status)
    );
    if (!hadTender) return 'paid';
    if (net <= tol && list.every((p) => p.status === 'refund')) return 'refund';
    if (net <= tol) {
        return list.some(
            (p) =>
                p.status === 'refund' ||
                p.status === 'partial_refund' ||
                parseFloat(p.refundedAmount || 0) > tol
        )
            ? 'refund'
            : 'paid';
    }
    return 'pending';
}

function deriveAggregatePaymentStatus(orderTotal, payments) {
    const total = roundMoney(parseFloat(orderTotal) || 0);
    const tol = getTolerance();
    const list = toPlainPayments(payments);
    const net = sumNetCollected(list);

    if (list.length === 0) {
        return total <= tol ? 'paid' : 'pending';
    }

    const fullRefundOnly = list.every((p) => p.status === 'refund');
    if (fullRefundOnly && net <= tol) {
        return 'refund';
    }

    const outstanding = computeOutstanding(total, list);
    if (outstanding > tol) {
        return 'pending';
    }

    const hasPartialRefundSale = list.some(
        (p) =>
            p.status === 'partial_refund' &&
            normalizePaymentRole(p.paymentRole) !== 'balance_due'
    );
    if (hasPartialRefundSale) {
        return 'partial_refund';
    }

    return 'paid';
}

function attachDerivedPaymentFieldsToOrderJson(orderData) {
    if (!orderData || typeof orderData !== 'object') return orderData;
    const total = orderData.totalAmount;
    const payments = orderData.payments || [];
    if (orderData.status === 'cancel') {
        orderData.balanceDue = 0;
        orderData.paymentStatus = deriveCancelledAggregatePaymentStatus(payments);
        return orderData;
    }
    orderData.paymentStatus = deriveAggregatePaymentStatus(total, payments);
    orderData.balanceDue = computeOutstanding(total, payments);
    return orderData;
}

async function persistOrderPaymentAggregate(orderId, transaction) {
    const order = await Order.findByPk(orderId, { transaction });
    if (!order) return;
    const payments = await Payment.findAll({ where: { orderId }, transaction });
    const status =
        order.status === 'cancel'
            ? deriveCancelledAggregatePaymentStatus(payments)
            : deriveAggregatePaymentStatus(order.totalAmount, payments);
    await order.update({ paymentStatus: status }, { transaction });
}

async function syncBalanceDuePayment(orderId, orderTotal, transaction) {
    const order = await Order.findByPk(orderId, { transaction });
    if (order && order.status === 'cancel') {
        const pendings = await Payment.findAll({
            where: { orderId, status: 'pending' },
            transaction,
        });
        for (const row of pendings) {
            await row.destroy({ transaction });
        }
        return;
    }

    const payments = await Payment.findAll({ where: { orderId }, transaction });
    const outstanding = computeOutstanding(orderTotal, payments);
    const tol = getTolerance();

    const balanceRows = await Payment.findAll({
        where: { orderId, status: 'pending', paymentRole: 'balance_due' },
        order: [['id', 'ASC']],
        transaction,
    });

    if (outstanding <= tol) {
        for (const row of balanceRows) {
            await row.destroy({ transaction });
        }
        return;
    }

    const targetAmount = roundMoney(outstanding);
    if (balanceRows.length === 0) {
        await Payment.create(
            {
                orderId,
                paymentMethod: 'cash',
                amount: targetAmount,
                status: 'pending',
                paymentRole: 'balance_due',
                userId: null,
            },
            { transaction }
        );
        return;
    }

    const [keep, ...dupes] = balanceRows;
    for (const d of dupes) {
        await d.destroy({ transaction });
    }
    await keep.update({ amount: targetAmount }, { transaction });
}

function logIgnoredClientPaymentStatus(orderId, clientVal, derived) {
    if (clientVal === undefined || clientVal === null || clientVal === '') return;
    const c = String(clientVal).toLowerCase();
    const d = String(derived).toLowerCase();
    if (c !== d) {
        console.warn(
            `[orderPaymentState] order ${orderId}: ignoring client paymentStatus "${clientVal}" (derived "${derived}")`
        );
    }
}

async function trySettleExistingPendingPayment({
    orderId,
    paymentMethod,
    amount,
    transactionId,
    userId,
    transaction,
}) {
    const requested = roundMoney(parseFloat(amount) || 0);
    const centsTolerance = Math.max(2, Math.ceil(getTolerance() * 100));

    const pendingRows = await Payment.findAll({
        where: { orderId, status: 'pending' },
        order: [['id', 'ASC']],
        transaction,
    });

    const sorted = pendingRows.slice().sort((a, b) => {
        const ad = normalizePaymentRole(a.paymentRole) === 'balance_due' ? 0 : 1;
        const bd = normalizePaymentRole(b.paymentRole) === 'balance_due' ? 0 : 1;
        if (ad !== bd) return ad - bd;
        return a.id - b.id;
    });

    const matchRow = sorted.find((row) => amountsRoughlyEqual(row.amount, requested, centsTolerance));

    if (!matchRow) {
        return { settled: false };
    }

    await matchRow.update(
        {
            paymentMethod,
            amount: requested,
            status: 'paid',
            transactionId: transactionId !== undefined ? transactionId : matchRow.transactionId,
            userId: userId !== undefined ? userId : matchRow.userId,
            paymentRole: 'sale',
        },
        { transaction }
    );

    return { settled: true, payment: matchRow };
}

function wouldDoubleCoverOrder(orderTotal, payments, newPaidAmount) {
    const total = roundMoney(parseFloat(orderTotal) || 0);
    const net = sumNetCollected(payments);
    const add = roundMoney(parseFloat(newPaidAmount) || 0);
    const tol = getTolerance();
    return net + add > total + tol;
}

module.exports = {
    getTolerance,
    PAYMENT_LIST_ATTRIBUTES,
    normalizePaymentRole,
    effectiveCollected,
    sumNetCollected,
    computeOutstanding,
    deriveAggregatePaymentStatus,
    deriveCancelledAggregatePaymentStatus,
    attachDerivedPaymentFieldsToOrderJson,
    persistOrderPaymentAggregate,
    syncBalanceDuePayment,
    logIgnoredClientPaymentStatus,
    trySettleExistingPendingPayment,
    wouldDoubleCoverOrder,
};
