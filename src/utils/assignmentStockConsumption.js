const { Transaction } = require('sequelize');
const StockItem = require('../models/StockItem');
const Material = require('../models/Material');
const MaterialBranch = require('../models/MaterialBranch');
const { isStockPastExpiryGoodThrough, computeStockStatus } = require('./stockExpiry');

function normalizeUnit(unit) {
    if (!unit) return null;
    const u = String(unit).trim().toLowerCase();
    if (u === 'pcs' || u === 'pc') return 'pieces';
    return u;
}

function unitsCompatible(stockUnit, lineUnit) {
    return normalizeUnit(stockUnit) === normalizeUnit(lineUnit);
}

function roundQty3(v) {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 1000) / 1000;
}

/**
 * Aggregate positive qty per stockId from normalized material lines.
 * @returns {Map<number, { totalQty: number, materialId: number, qtyUnit: string }>}
 */
function aggregateConsumptionByStock(lines) {
    const map = new Map();
    for (const line of lines) {
        const stockId = line.stockId;
        const qty = roundQty3(line.qtyValue);
        if (stockId == null || qty <= 0) continue;

        const mid = line.materialId;
        if (typeof mid !== 'number' || Number.isNaN(mid)) {
            const err = new Error('Each materialsUsed line with stockId must include a valid materialId');
            err.statusCode = 400;
            throw err;
        }

        if (!map.has(stockId)) {
            map.set(stockId, { totalQty: qty, materialId: mid, qtyUnit: line.qtyUnit || 'pieces' });
        } else {
            const cur = map.get(stockId);
            if (cur.materialId !== mid) {
                const err = new Error(`Inconsistent materialId for stockId ${stockId} in materialsUsed`);
                err.statusCode = 400;
                throw err;
            }
            if (!unitsCompatible(cur.qtyUnit, line.qtyUnit)) {
                const err = new Error(`Inconsistent qtyUnit for stockId ${stockId} in materialsUsed`);
                err.statusCode = 400;
                throw err;
            }
            cur.totalQty = roundQty3(cur.totalQty + qty);
        }
    }
    return map;
}

async function getMinStockForRow(materialId, branchId, transaction) {
    const mb = await MaterialBranch.findOne({
        where: { materialId, branchId },
        transaction,
    });
    if (mb) return Number(mb.minStockValue) || 0;
    const mat = await Material.findByPk(materialId, {
        attributes: ['minStockValue'],
        transaction,
    });
    return mat ? Number(mat.minStockValue) || 0 : 0;
}

/**
 * Apply a signed delta to stock quantity (negative = consume, positive = restore).
 */
async function applyQuantityDelta(stockId, delta, transaction) {
    const stock = await StockItem.findByPk(stockId, {
        transaction,
        lock: Transaction.LOCK.UPDATE,
    });
    if (!stock) {
        const err = new Error(`Stock item ${stockId} not found`);
        err.statusCode = 400;
        throw err;
    }

    const current = roundQty3(stock.quantityValue);
    const next = roundQty3(current + delta);
    if (next < -0.0001) {
        const err = new Error(
            `Insufficient stock for batch line ${stockId}: need ${roundQty3(Math.abs(delta))}, on hand ${current}`
        );
        err.statusCode = 409;
        throw err;
    }

    const minStock = await getMinStockForRow(stock.materialId, stock.branchId, transaction);
    const status = computeStockStatus(next, stock.expiryDate, minStock);
    await stock.update({ quantityValue: next, status }, { transaction });
    return stock;
}

/**
 * Validate and decrease stock for each batch line (assignment branch must match stock branch).
 * @param {Array<{ stockId: number|null, materialId: any, qtyValue: number, qtyUnit: string }>} normalizedLines
 * @param {number} assignmentBranchId
 */
async function consumeForAssignment(normalizedLines, assignmentBranchId, transaction) {
    const agg = aggregateConsumptionByStock(normalizedLines);
    const ids = [...agg.keys()].sort((a, b) => a - b);

    for (const stockId of ids) {
        const { totalQty, materialId, qtyUnit } = agg.get(stockId);
        const stock = await StockItem.findByPk(stockId, {
            transaction,
            lock: Transaction.LOCK.UPDATE,
        });
        if (!stock) {
            const err = new Error(`Stock item ${stockId} not found`);
            err.statusCode = 400;
            throw err;
        }
        if (!stock.isActive) {
            const err = new Error(`Stock item ${stockId} is not active`);
            err.statusCode = 400;
            throw err;
        }
        if (stock.branchId !== assignmentBranchId) {
            const err = new Error(
                `Stock item ${stockId} belongs to a different branch than this assignment`
            );
            err.statusCode = 400;
            throw err;
        }
        if (stock.materialId !== materialId) {
            const err = new Error(
                `materialId does not match stock item ${stockId} (expected material ${stock.materialId})`
            );
            err.statusCode = 400;
            throw err;
        }
        if (isStockPastExpiryGoodThrough(stock.expiryDate)) {
            const err = new Error(`Stock item ${stockId} is expired and cannot be consumed`);
            err.statusCode = 400;
            throw err;
        }
        if (!unitsCompatible(stock.quantityUnit, qtyUnit)) {
            const err = new Error(
                `Unit mismatch for stock ${stockId}: stock uses "${stock.quantityUnit}", assignment line uses "${qtyUnit}"`
            );
            err.statusCode = 400;
            throw err;
        }

        const current = roundQty3(stock.quantityValue);
        if (current + 0.0001 < totalQty) {
            const err = new Error(
                `Insufficient stock for batch line ${stockId}: need ${totalQty}, on hand ${current}`
            );
            err.statusCode = 409;
            throw err;
        }

        const minStock = await getMinStockForRow(stock.materialId, stock.branchId, transaction);
        const next = roundQty3(current - totalQty);
        const status = computeStockStatus(next, stock.expiryDate, minStock);
        await stock.update({ quantityValue: next, status }, { transaction });
    }
}

/**
 * Restore stock for previously consumed lines (positive delta).
 */
async function restoreForAssignment(normalizedLines, transaction) {
    const agg = aggregateConsumptionByStock(normalizedLines);
    const ids = [...agg.keys()].sort((a, b) => a - b);

    for (const stockId of ids) {
        const { totalQty } = agg.get(stockId);
        await applyQuantityDelta(stockId, totalQty, transaction);
    }
}

async function attachStockSnapshotsToLines(normalizedLines, transaction) {
    const out = [];
    for (const line of normalizedLines) {
        const copy = { ...line };
        if (copy.stockId != null && roundQty3(copy.qtyValue) > 0) {
            const s = await StockItem.findByPk(copy.stockId, {
                attributes: ['batchNo', 'expiryDate'],
                transaction,
            });
            if (s) {
                copy.stockBatchNo = s.batchNo ?? null;
                copy.stockExpiryDate = s.expiryDate ?? null;
            }
        }
        out.push(copy);
    }
    return out;
}

module.exports = {
    normalizeUnit,
    unitsCompatible,
    roundQty3,
    aggregateConsumptionByStock,
    consumeForAssignment,
    restoreForAssignment,
    attachStockSnapshotsToLines,
};
