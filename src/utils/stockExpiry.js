function getLocalCalendarTodayYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function toDateOnlyString(expiryDate) {
    if (expiryDate == null || expiryDate === '') return null;
    if (typeof expiryDate === 'string') return expiryDate.slice(0, 10);
    if (expiryDate instanceof Date) {
        const y = expiryDate.getFullYear();
        const m = String(expiryDate.getMonth() + 1).padStart(2, '0');
        const day = String(expiryDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    return String(expiryDate).slice(0, 10);
}

function isStockPastExpiryGoodThrough(expiryDate) {
    const exp = toDateOnlyString(expiryDate);
    if (!exp || !/^\d{4}-\d{2}-\d{2}$/.test(exp)) return false;
    return getLocalCalendarTodayYYYYMMDD() > exp;
}

function computeStockStatus(quantityValue, expiryDate, minStockValue) {
    if (isStockPastExpiryGoodThrough(expiryDate)) return 'expired';
    const q = Number(quantityValue) || 0;
    const min = Number(minStockValue) || 0;
    if (q <= 0) return 'out';
    if (min > 0 && q < min) return 'low';
    return 'available';
}

module.exports = {
    getLocalCalendarTodayYYYYMMDD,
    toDateOnlyString,
    isStockPastExpiryGoodThrough,
    computeStockStatus,
};
