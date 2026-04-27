

const SERVER_COMPUTED_ORDER_TAX = 0;

function getTaxRate() {
    return SERVER_COMPUTED_ORDER_TAX;
}

function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function modificationEntryQty(m) {
    if (m == null) return 1;
    const raw = m.quantity ?? m.qty;
    if (raw == null || raw === '') return 1;
    return Math.max(1, parseInt(raw, 10) || 1);
}

function modificationSum(mods) {
    if (!Array.isArray(mods)) return 0;
    return mods.reduce((sum, m) => {
        const p = parseFloat(m.price) || 0;
        return sum + p * modificationEntryQty(m);
    }, 0);
}

function mapModificationsForNormalize(mods) {
    return (mods || []).map((m) => ({
        price: m.price,
        quantity: m.quantity,
        qty: m.qty,
    }));
}

function lineSubtotal(item) {
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    const unit = parseFloat(item.unitPrice) || 0;
    const modSum = modificationSum(item.modifications);
    // Product discount is already accounted for in the frontend's calculations
    const raw = unit * qty + modSum;
    return Math.max(0, roundMoney(raw));
}

function normalizeItem(item) {
    if (item && typeof item.toJSON === 'function') {
        const plain = item.toJSON();
        return {
            quantity: plain.quantity,
            unitPrice: plain.unitPrice,
            productDiscount: plain.productDiscount,
            modifications: mapModificationsForNormalize(plain.modifications),
        };
    }
    return {
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        productDiscount: item.productDiscount,
        modifications: mapModificationsForNormalize(item.modifications),
    };
}

function dedupeOrderItemsById(items) {
    const list = Array.isArray(items) ? items : [];
    const seen = new Set();
    const out = [];
    for (const it of list) {
        const plain = it && typeof it.toJSON === 'function' ? it.toJSON() : it;
        const id = plain && plain.id;
        if (id != null) {
            if (seen.has(id)) continue;
            seen.add(id);
        }
        out.push(it);
    }
    return out;
}

function computeOrderTotalsFromLines(items, orderDiscountRaw, serviceChargeRaw = 0, deliveryChargeRaw = 0) {
    const list = dedupeOrderItemsById(items);
    const lineSubtotalSum = roundMoney(
        list.reduce((sum, item) => sum + lineSubtotal(normalizeItem(item)), 0)
    );
    const orderDisc = Math.max(0, parseFloat(orderDiscountRaw) || 0);
    const serviceCharge = Math.max(0, parseFloat(serviceChargeRaw) || 0);
    const deliveryCharge = Math.max(0, parseFloat(deliveryChargeRaw) || 0);
    const subtotalAfterOrderDiscount = Math.max(0, roundMoney(lineSubtotalSum - orderDisc));
    const tax = SERVER_COMPUTED_ORDER_TAX;
    const totalAmount = roundMoney(subtotalAfterOrderDiscount + tax + serviceCharge + deliveryCharge);
    return {
        lineSubtotalSum,
        subtotalAfterOrderDiscount,
        tax,
        serviceCharge,
        deliveryCharge,
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
