// Line totals → order discount → tax (ORDER_TAX_RATE, default 0.1) → totalAmount.

const DEFAULT_TAX_RATE = 0.1;

function getTaxRate() {
    const r = parseFloat(process.env.ORDER_TAX_RATE);
    return Number.isFinite(r) && r >= 0 ? r : DEFAULT_TAX_RATE;
}

function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function lineSubtotal(item) {
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    const unit = parseFloat(item.unitPrice) || 0;
    const lineDisc = parseFloat(item.productDiscount) || 0;
    const mods = item.modifications || [];
    const modPerUnit = mods.reduce((sum, m) => sum + (parseFloat(m.price) || 0), 0);
    const raw = unit * qty - lineDisc + modPerUnit * qty;
    return Math.max(0, roundMoney(raw));
}

function normalizeItem(item) {
    if (item && typeof item.toJSON === 'function') {
        const plain = item.toJSON();
        return {
            quantity: plain.quantity,
            unitPrice: plain.unitPrice,
            productDiscount: plain.productDiscount,
            modifications: (plain.modifications || []).map((m) => ({ price: m.price })),
        };
    }
    return {
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        productDiscount: item.productDiscount,
        modifications: (item.modifications || []).map((m) => ({ price: m.price })),
    };
}

function computeOrderTotalsFromLines(items, orderDiscountRaw) {
    const list = Array.isArray(items) ? items : [];
    const lineSubtotalSum = roundMoney(
        list.reduce((sum, item) => sum + lineSubtotal(normalizeItem(item)), 0)
    );
    const orderDisc = Math.max(0, parseFloat(orderDiscountRaw) || 0);
    const subtotalAfterOrderDiscount = Math.max(0, roundMoney(lineSubtotalSum - orderDisc));
    const rate = getTaxRate();
    const tax = roundMoney(subtotalAfterOrderDiscount * rate);
    const totalAmount = roundMoney(subtotalAfterOrderDiscount + tax);
    return {
        lineSubtotalSum,
        subtotalAfterOrderDiscount,
        tax,
        totalAmount,
    };
}

function amountsRoughlyEqual(a, b, cents = 2) {
    return Math.abs(parseFloat(a) - parseFloat(b)) <= cents / 100;
}

function logTotalsMismatchIfAny(orderId, clientTax, clientTotal, computed, context) {
    const hasClientTax = clientTax !== undefined && clientTax !== null && clientTax !== '';
    const hasClientTotal = clientTotal !== undefined && clientTotal !== null && clientTotal !== '';
    if (!hasClientTax && !hasClientTotal) return;
    const taxMismatch = hasClientTax && !amountsRoughlyEqual(clientTax, computed.tax);
    const totalMismatch = hasClientTotal && !amountsRoughlyEqual(clientTotal, computed.totalAmount);
    if (taxMismatch || totalMismatch) {
        console.warn(
            `[orderTotals] ${context} order ${orderId}: client tax/total vs computed`,
            { clientTax, clientTotal, computedTax: computed.tax, computedTotal: computed.totalAmount }
        );
    }
}

module.exports = {
    getTaxRate,
    roundMoney,
    lineSubtotal,
    computeOrderTotalsFromLines,
    logTotalsMismatchIfAny,
    amountsRoughlyEqual,
};
