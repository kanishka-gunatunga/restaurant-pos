

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

function toMoneyCents(value) {
    return Math.round((roundMoney(parseFloat(value) || 0)) * 100 + Number.EPSILON);
}

function centsToMoney(cents) {
    return roundMoney(Math.max(0, cents) / 100);
}

function getOutstandingToleranceCents(orderTotal) {
    const base = Math.max(1, Math.ceil(getTolerance() * 100));
    const pctRaw = parseFloat(process.env.ORDER_PAYMENT_TOLERANCE_PCT);
    const pct = Number.isFinite(pctRaw) && pctRaw >= 0 ? pctRaw : 0.005;
    const totalC = toMoneyCents(orderTotal);
    const pctPart = Math.ceil(totalC * pct);
    const capRaw = parseFloat(process.env.ORDER_PAYMENT_TOLERANCE_CAP);
    const capC = Number.isFinite(capRaw) && capRaw >= 0 ? toMoneyCents(capRaw) : toMoneyCents(10);
    return Math.min(capC, Math.max(base, pctPart));
}

function firstPaymentOverpayAllowedCents(orderTotal) {
    const totalC = toMoneyCents(orderTotal);
    const capCur = parseFloat(process.env.ORDER_FIRST_PAY_OVERPAY_CAP);
    const capC = Number.isFinite(capCur) && capCur >= 0 ? toMoneyCents(capCur) : toMoneyCents(2000);
    const pctRaw = parseFloat(process.env.ORDER_FIRST_PAY_OVERPAY_PCT);
    const pct = Number.isFinite(pctRaw) && pctRaw >= 0 ? pctRaw : 0.75;
    const pctC = Math.ceil(totalC * pct);
    const floorC = toMoneyCents(25);
    return Math.min(capC, Math.max(floorC, pctC));
}

function computeOutstandingCents(orderTotal, payments) {
    const totalC = toMoneyCents(orderTotal);
    let netC = 0;
    for (const p of payments || []) {
        netC += toMoneyCents(effectiveCollected(p));
    }
    return Math.max(0, totalC - netC);
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
    const rawC = computeOutstandingCents(orderTotal, payments);
    const tolC = getOutstandingToleranceCents(orderTotal);
    if (rawC <= tolC) {
        return 0;
    }
    return centsToMoney(rawC);
}

function resolveOrderTotalForBalanceFromOrderLike(orderLike) {
    if (!orderLike) {
        return 0;
    }
    return roundMoney(parseFloat(orderLike.totalAmount) || 0);
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
    const matchTolC = getOutstandingToleranceCents(total);
    const list = toPlainPayments(payments);
    const net = sumNetCollected(list);

    if (list.length === 0) {
        return total <= tol ? 'paid' : 'pending';
    }

    const fullRefundOnly = list.every((p) => p.status === 'refund');
    if (fullRefundOnly && net <= tol) {
        return 'refund';
    }

    const outstandingC = computeOutstandingCents(total, list);
    if (outstandingC > matchTolC) {
        return 'pending';
    }

    const overC = toMoneyCents(net) - toMoneyCents(total);
    if (overC > matchTolC) {
        const dustRaw = parseFloat(process.env.ORDER_OVERPAY_DUST);
        const dustC =
            Number.isFinite(dustRaw) && dustRaw >= 0 ? toMoneyCents(dustRaw) : toMoneyCents(2);
        const treatAsPaidCeiling = Math.max(matchTolC, dustC);
        if (overC <= treatAsPaidCeiling) {
            return 'paid';
        }
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
    const tolC = getOutstandingToleranceCents(totalForBalance);
    const rawOC = computeOutstandingCents(totalForBalance, payments);
    orderData.balanceDue = balanceDue;
    orderData.balance_due = balanceDue;
    orderData.paymentStatus = deriveAggregatePaymentStatus(totalForBalance, payments);
    orderData.requiresAdditionalPayment = rawOC > tolC;
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
    const outC = computeOutstandingCents(financialTotal, payments);
    const tolC = getOutstandingToleranceCents(financialTotal);

    const balanceRows = await Payment.findAll({
        where: { orderId, status: 'pending', paymentRole: 'balance_due' },
        order: [['id', 'ASC']],
        transaction,
    });

    if (outC <= tolC) {
        for (const row of balanceRows) {
            await row.destroy({ transaction });
        }
        return;
    }

    const targetAmount = centsToMoney(outC);
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
    const orderTotalForMatch = roundMoney(parseFloat(order.totalAmount) || 0);
    const matchTolC = getOutstandingToleranceCents(orderTotalForMatch);

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

    const reqC = toMoneyCents(requested);
    const matchByLineAmount = sorted.find((row) => {
        const rowC = toMoneyCents(row.amount);
        return (
            Math.abs(rowC - reqC) <= matchTolC ||
            amountsRoughlyEqual(row.amount, requested, centsTolerance)
        );
    });
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
        const outC = computeOutstandingCents(financialTotal, allPayments);
        const settleTol = Math.max(matchTolC, centsTolerance);
        if (Math.abs(reqC - outC) <= settleTol) {
            return applySettle(bdOnly[0]);
        }
    }

    return { settled: false };
}

function wouldDoubleCoverOrder(orderTotal, payments, newPaidAmount) {
    const totalC = toMoneyCents(orderTotal);
    const netC = (payments || []).reduce((s, p) => s + toMoneyCents(effectiveCollected(p)), 0);
    const addC = toMoneyCents(newPaidAmount);
    const tolC = getOutstandingToleranceCents(orderTotal);
    const sum = netC + addC;
    const threshold = totalC + tolC;

    if (sum <= threshold) {
        return false;
    }

    const alreadyFullyPaid = netC >= totalC - tolC;
    if (alreadyFullyPaid && addC > tolC) {
        return true;
    }

    const fullyUnpaid = netC === 0;
    if (fullyUnpaid) {
        const excessCents = sum - totalC;
        const maxExcess = firstPaymentOverpayAllowedCents(orderTotal) + tolC;
        if (excessCents <= maxExcess) {
            return false;
        }
    }

    return true;
}

module.exports = {
    getTolerance,
    getOutstandingToleranceCents,
    computeOutstandingCents,
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
