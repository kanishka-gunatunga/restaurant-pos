// Order payment aggregates: env ORDER_MONEY_TOLERANCE (default 0.02), balance_due pending rows, idempotent settle on POST /payments.

const Payment = require('../models/Payment');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderItemModification = require('../models/OrderItemModification');
const { roundMoney, amountsRoughlyEqual, computeOrderTotalsFromLines } = require('./orderTotals');

const orderItemsForBalanceInclude = {
    model: OrderItem,
    as: 'items',
    attributes: ['quantity', 'unitPrice', 'productDiscount'],
    include: [{ model: OrderItemModification, as: 'modifications', attributes: ['price'] }],
};

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
    if (role == null || role === '') return 'sale';
    const s = String(role).trim().toLowerCase();
    if (s === 'balance_due') return 'balance_due';
    return 'sale';
}

function normalizePaymentRoleFromPlain(p) {
    const plain = typeof p === 'object' && p != null ? p : {};
    return normalizePaymentRole(plain.paymentRole ?? plain.payment_role);
}

function toPlainPayments(payments) {
    return (payments || []).map((p) => (typeof p.toJSON === 'function' ? p.toJSON() : { ...p }));
}

function parseRefundedOnPayment(p) {
    const plain = typeof p === 'object' && p != null ? p : {};
    const v = plain.refundedAmount ?? plain.refunded_amount;
    return Math.max(0, parseFloat(v) || 0);
}

function effectiveCollected(p) {
    const plain = typeof p.toJSON === 'function' ? p.toJSON() : p;
    const amount = parseFloat(plain.amount) || 0;
    const refunded = parseRefundedOnPayment(plain);
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

function resolveOrderTotalForBalanceFromOrderLike(orderLike) {
    if (!orderLike || orderLike.status === 'cancel') {
        return roundMoney(parseFloat(orderLike?.totalAmount) || 0);
    }
    const stored = roundMoney(parseFloat(orderLike.totalAmount) || 0);
    const items = orderLike.items;
    if (!items?.length) return stored;
    const disc = Math.max(0, parseFloat(orderLike.orderDiscount) || 0);
    const lineBased = computeOrderTotalsFromLines(items, disc).totalAmount;
    const tol = getTolerance();
    const centTol = Math.max(2, Math.ceil(tol * 100));
    if (amountsRoughlyEqual(lineBased, stored, centTol)) return stored;
    return roundMoney(lineBased);
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
                parseRefundedOnPayment(p) > tol
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

    const hasPendingBalanceDue = list.some(
        (p) => p.status === 'pending' && normalizePaymentRoleFromPlain(p) === 'balance_due'
    );
    const outstanding = computeOutstanding(total, list);
    if (hasPendingBalanceDue || outstanding > tol) {
        return 'pending';
    }

    const overCollected = roundMoney(net - total);
    if (overCollected > tol) {
        return 'partial_refund';
    }

    const salePaidOrPartial = list.filter(
        (p) =>
            (p.status === 'paid' || p.status === 'partial_refund') &&
            normalizePaymentRoleFromPlain(p) !== 'balance_due'
    );
    const saleTenderCount = salePaidOrPartial.length;
    const hasPartialRefundAudit = salePaidOrPartial.some(
        (p) =>
            p.status === 'partial_refund' ||
            (p.status === 'paid' && parseRefundedOnPayment(p) > tol)
    );
    if (hasPartialRefundAudit && saleTenderCount === 1) {
        return 'partial_refund';
    }

    return 'paid';
}

function attachDerivedPaymentFieldsToOrderJson(orderData) {
    if (!orderData || typeof orderData !== 'object') return orderData;
    const total = orderData.totalAmount;
    const payments = orderData.payments || [];
    const tol = getTolerance();
    if (orderData.status === 'cancel') {
        orderData.balanceDue = 0;
        orderData.balance_due = 0;
        orderData.paymentStatus = deriveCancelledAggregatePaymentStatus(payments);
        orderData.requiresAdditionalPayment = false;
        orderData.requires_additional_payment = false;
        return orderData;
    }
    const totalForBalance = resolveOrderTotalForBalanceFromOrderLike(orderData);
    const balanceDue = computeOutstanding(totalForBalance, payments);
    orderData.balanceDue = balanceDue;
    orderData.balance_due = balanceDue;
    orderData.paymentStatus = deriveAggregatePaymentStatus(totalForBalance, payments);
    const hasPendingBalanceDue = payments.some(
        (p) => p.status === 'pending' && normalizePaymentRoleFromPlain(p) === 'balance_due'
    );
    orderData.requiresAdditionalPayment = balanceDue > tol || hasPendingBalanceDue;
    orderData.requires_additional_payment = orderData.requiresAdditionalPayment;
    return orderData;
}

async function persistOrderPaymentAggregate(orderId, transaction) {
    await syncBalanceDuePayment(orderId, transaction);
    const order = await Order.findByPk(orderId, {
        transaction,
        include: [orderItemsForBalanceInclude],
    });
    if (!order) return;
    const payments = await Payment.findAll({ where: { orderId }, transaction });
    const financialTotal = resolveOrderTotalForBalanceFromOrderLike(order);
    const status =
        order.status === 'cancel'
            ? deriveCancelledAggregatePaymentStatus(payments)
            : deriveAggregatePaymentStatus(financialTotal, payments);
    await order.update({ paymentStatus: status }, { transaction });
}

async function syncBalanceDuePayment(orderId, transaction) {
    const order = await Order.findByPk(orderId, {
        transaction,
        attributes: ['id', 'status', 'totalAmount', 'orderDiscount'],
        include: [orderItemsForBalanceInclude],
    });
    if (!order) return;
    if (order.status === 'cancel') {
        const pendings = await Payment.findAll({
            where: { orderId, status: 'pending' },
            transaction,
        });
        for (const row of pendings) {
            await row.destroy({ transaction });
        }
        return;
    }

    const disc = Math.max(0, parseFloat(order.orderDiscount) || 0);
    if (order.items?.length) {
        const computed = computeOrderTotalsFromLines(order.items, disc);
        const lineBased = roundMoney(computed.totalAmount);
        const stored = roundMoney(parseFloat(order.totalAmount) || 0);
        const tolHeal = getTolerance();
        if (lineBased + tolHeal < stored) {
            await order.update(
                { totalAmount: computed.totalAmount, tax: computed.tax },
                { transaction }
            );
            order.setDataValue('totalAmount', computed.totalAmount);
            order.setDataValue('tax', computed.tax);
        }
    }

    const payments = await Payment.findAll({ where: { orderId }, transaction });
    const financialTotal = resolveOrderTotalForBalanceFromOrderLike(order);
    const outstanding = computeOutstanding(financialTotal, payments);
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
    const order = await Order.findByPk(orderId, { transaction });
    if (!order) return { settled: false };

    const requested = roundMoney(parseFloat(amount) || 0);
    const centsTolerance = Math.max(2, Math.ceil(getTolerance() * 100));

    const pendingRows = await Payment.findAll({
        where: { orderId, status: 'pending' },
        order: [['id', 'ASC']],
        transaction,
    });

    const sorted = pendingRows.slice().sort((a, b) => {
        const ad = normalizePaymentRoleFromPlain(a) === 'balance_due' ? 0 : 1;
        const bd = normalizePaymentRoleFromPlain(b) === 'balance_due' ? 0 : 1;
        if (ad !== bd) return ad - bd;
        return a.id - b.id;
    });

    const applySettle = async (row) => {
        await row.update(
            {
                paymentMethod,
                amount: requested,
                status: 'paid',
                transactionId: transactionId !== undefined ? transactionId : row.transactionId,
                userId: userId !== undefined ? userId : row.userId,
                paymentRole: 'sale',
            },
            { transaction }
        );
        return { settled: true, payment: row };
    };

    const matchByLineAmount = sorted.find((row) =>
        amountsRoughlyEqual(row.amount, requested, centsTolerance)
    );
    if (matchByLineAmount) {
        return applySettle(matchByLineAmount);
    }

    const bdOnly = sorted.filter((r) => normalizePaymentRoleFromPlain(r) === 'balance_due');
    if (bdOnly.length === 1) {
        const allPayments = await Payment.findAll({ where: { orderId }, transaction });
        const orderForTotal = await Order.findByPk(orderId, {
            transaction,
            attributes: ['id', 'totalAmount', 'orderDiscount', 'status'],
            include: [orderItemsForBalanceInclude],
        });
        const financialTotal = orderForTotal
            ? resolveOrderTotalForBalanceFromOrderLike(orderForTotal)
            : roundMoney(parseFloat(order.totalAmount) || 0);
        const outstanding = computeOutstanding(financialTotal, allPayments);
        if (amountsRoughlyEqual(requested, outstanding, centsTolerance)) {
            return applySettle(bdOnly[0]);
        }
    }

    return { settled: false };
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
    orderItemsForBalanceInclude,
    normalizePaymentRole,
    effectiveCollected,
    sumNetCollected,
    computeOutstanding,
    resolveOrderTotalForBalanceFromOrderLike,
    deriveAggregatePaymentStatus,
    deriveCancelledAggregatePaymentStatus,
    attachDerivedPaymentFieldsToOrderJson,
    persistOrderPaymentAggregate,
    syncBalanceDuePayment,
    logIgnoredClientPaymentStatus,
    trySettleExistingPendingPayment,
    wouldDoubleCoverOrder,
};
