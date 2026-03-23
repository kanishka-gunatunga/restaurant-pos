const StockItem = require('../models/StockItem');
const Material = require('../models/Material');
const MaterialBranch = require('../models/MaterialBranch');
const { computeStockStatus } = require('../utils/stockExpiry');

async function runNormalizeStockStatus() {
    const stocks = await StockItem.findAll({
        attributes: ['id', 'materialId', 'branchId', 'quantityValue', 'expiryDate', 'status'],
    });
    const materials = await Material.findAll({ attributes: ['id', 'minStockValue'] });
    const materialMap = new Map(materials.map((m) => [m.id, m]));
    const mbs = await MaterialBranch.findAll({
        attributes: ['materialId', 'branchId', 'minStockValue'],
    });
    const mbMap = new Map(mbs.map((mb) => [`${mb.materialId}:${mb.branchId}`, mb]));

    let updated = 0;
    for (const s of stocks) {
        const key = `${s.materialId}:${s.branchId}`;
        const mb = mbMap.get(key);
        const min = mb
            ? Number(mb.minStockValue) || 0
            : Number(materialMap.get(s.materialId)?.minStockValue) || 0;
        const next = computeStockStatus(s.quantityValue, s.expiryDate, min);
        if (next !== s.status) {
            await s.update({ status: next });
            updated += 1;
        }
    }
    return { updated, total: stocks.length };
}

module.exports = { runNormalizeStockStatus };
