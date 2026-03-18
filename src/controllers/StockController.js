const { Op } = require('sequelize');
const { Readable } = require('stream');
const csvParser = require('csv-parser');
const sequelize = require('../config/database');
const StockItem = require('../models/StockItem');
const Material = require('../models/Material');
const Supplier = require('../models/Supplier');
const Branch = require('../models/Branch');
const MaterialBranch = require('../models/MaterialBranch');
const {
    getLocalCalendarTodayYYYYMMDD,
    isStockPastExpiryGoodThrough,
    computeStockStatus,
} = require('../utils/stockExpiry');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;

async function loadMaterialBranchMapForStockRows(stockRowsJson) {
    const pairs = [];
    const seen = new Set();
    for (const r of stockRowsJson) {
        const k = `${r.materialId}:${r.branchId}`;
        if (!seen.has(k)) {
            seen.add(k);
            pairs.push({ materialId: r.materialId, branchId: r.branchId });
        }
    }
    if (!pairs.length) return new Map();
    const mbs = await MaterialBranch.findAll({
        where: { [Op.or]: pairs },
        attributes: ['materialId', 'branchId', 'minStockValue'],
    });
    return new Map(mbs.map((mb) => [`${mb.materialId}:${mb.branchId}`, mb]));
}

function effectiveMinStockForRow(row, mbMap) {
    const key = `${row.materialId}:${row.branchId}`;
    const mb = mbMap.get(key);
    if (mb) return Number(mb.minStockValue) || 0;
    const m = row.material;
    return m ? Number(m.minStockValue) || 0 : 0;
}

function applyDerivedStockFields(row, mbMap) {
    const min = effectiveMinStockForRow(row, mbMap);
    row.expired = isStockPastExpiryGoodThrough(row.expiryDate);
    row.status = computeStockStatus(row.quantityValue, row.expiryDate, min);
    return row;
}

function normalizeUnit(unit) {
    if (!unit) return null;
    const u = String(unit).trim().toLowerCase();
    if (u === 'pcs' || u === 'pc') return 'pieces';
    return u;
}

function isValidIsoDate(dateStr) {
    if (!dateStr) return true;
    const s = String(dateStr).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

async function parseCsvBuffer(buffer) {
    return await new Promise((resolve, reject) => {
        const rows = [];
        const stream = Readable.from(buffer);
        stream
            .pipe(csvParser({
                mapHeaders: ({ header }) => (header ? String(header).trim() : header),
                skipLines: 0,
            }))
            .on('data', (data) => rows.push(data))
            .on('end', () => resolve(rows))
            .on('error', (err) => reject(err));
    });
}

function getEffectiveMinStock(materialId, branchId, materialMap, materialBranchMap) {
    const mb = materialBranchMap.get(`${materialId}:${branchId}`);
    if (mb) return Number(mb.minStockValue) || 0;
    const material = materialMap.get(materialId);
    if (!material) return 0;
    return Number(material.minStockValue) || 0;
}

exports.listStocks = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE));
        const { q, branchId, category, status, includeInactive } = req.query;

        const baseWhere = {};
        if (includeInactive !== 'true') {
            baseWhere.isActive = true;
        }
        if (branchId && branchId !== 'all' && branchId !== '') {
            baseWhere.branchId = branchId;
        }

        const localToday = getLocalCalendarTodayYYYYMMDD();
        let where = { ...baseWhere };
        if (status && status !== 'all' && ['available', 'low', 'out', 'expired'].includes(status)) {
            if (status === 'expired') {
                where = {
                    [Op.and]: [
                        baseWhere,
                        {
                            [Op.or]: [
                                {
                                    [Op.and]: [
                                        { expiryDate: { [Op.ne]: null } },
                                        { expiryDate: { [Op.lt]: localToday } },
                                    ],
                                },
                                { status: 'expired' },
                            ],
                        },
                    ],
                };
            } else {
                where = {
                    [Op.and]: [
                        baseWhere,
                        { status },
                        {
                            [Op.or]: [
                                { expiryDate: null },
                                { expiryDate: { [Op.gte]: localToday } },
                            ],
                        },
                    ],
                };
            }
        }

        const materialWhere = {};
        if (q && String(q).trim()) {
            materialWhere.name = { [Op.like]: `%${String(q).trim()}%` };
        }
        if (category && category !== 'all') {
            materialWhere.category = category;
        }

        const includeMaterial = {
            model: Material,
            as: 'material',
            attributes: ['id', 'name', 'category', 'unit', 'minStockValue', 'minStockUnit'],
            ...(Object.keys(materialWhere).length > 0 && { where: materialWhere, required: true }),
        };

        const { count, rows } = await StockItem.findAndCountAll({
            where,
            include: [
                includeMaterial,
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
        });

        const jsonRows = rows.map((row) => row.toJSON());
        const mbMap = await loadMaterialBranchMapForStockRows(jsonRows);
        const data = jsonRows.map((s) => {
            applyDerivedStockFields(s, mbMap);
            s.materialName = s.material?.name;
            s.category = s.material?.category;
            s.supplierName = s.supplier?.name;
            delete s.material;
            delete s.supplier;
            return s;
        });

        res.json({ data, meta: { total: count, page, pageSize } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getStockById = async (req, res) => {
    try {
        const stock = await StockItem.findByPk(req.params.id, {
            include: [
                { model: Material, as: 'material', attributes: ['id', 'name', 'category', 'unit', 'minStockValue', 'minStockUnit'] },
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
                { model: Branch, as: 'branch', attributes: ['id', 'name'] },
            ],
        });
        if (!stock) return res.status(404).json({ message: 'Stock item not found' });
        const s = stock.toJSON();
        const mbMap = await loadMaterialBranchMapForStockRows([s]);
        applyDerivedStockFields(s, mbMap);
        s.materialName = s.material?.name;
        s.category = s.material?.category;
        s.supplierName = s.supplier?.name;
        delete s.material;
        delete s.supplier;
        res.json(s);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createStock = async (req, res) => {
    try {
        const { branchId, materialId, supplierId, batchNo, expiryDate, quantityValue, quantityUnit } = req.body;
        if (branchId == null || materialId == null || supplierId == null) {
            return res.status(400).json({ message: 'branchId, materialId and supplierId are required' });
        }
        const material = await Material.findByPk(materialId);
        if (!material) return res.status(400).json({ message: 'Material not found' });
        const supplier = await Supplier.findByPk(supplierId);
        if (!supplier) return res.status(400).json({ message: 'Supplier not found' });

        const qty = Number(quantityValue) ?? 0;

        let branchMin = await MaterialBranch.findOne({ where: { materialId, branchId } });
        const minStock = branchMin ? Number(branchMin.minStockValue) || 0 : Number(material.minStockValue) || 0;
        const status = computeStockStatus(qty, expiryDate, minStock);

        const stock = await StockItem.create({
            branchId,
            materialId,
            supplierId,
            batchNo: batchNo || null,
            expiryDate: expiryDate || null,
            quantityValue: qty,
            quantityUnit: quantityUnit || material.minStockUnit || 'pieces',
            status,
            isActive: true,
        });
        const out = (await StockItem.findByPk(stock.id, {
            include: [
                { model: Material, as: 'material', attributes: ['id', 'name', 'category', 'unit'] },
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
            ],
        })).toJSON();
        out.materialName = out.material?.name;
        out.category = out.material?.category;
        out.supplierName = out.supplier?.name;
        const mbMapOut = await loadMaterialBranchMapForStockRows([out]);
        applyDerivedStockFields(out, mbMapOut);
        delete out.material;
        delete out.supplier;
        res.status(201).json(out);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateStock = async (req, res) => {
    try {
        const stock = await StockItem.findByPk(req.params.id, { include: [{ model: Material, as: 'material', attributes: ['minStockValue'] }] });
        if (!stock) return res.status(404).json({ message: 'Stock item not found' });

        const { branchId, materialId, supplierId, batchNo, expiryDate, quantityValue, quantityUnit, isActive } = req.body;
        const updates = {};
        if (branchId !== undefined) updates.branchId = branchId;
        if (materialId !== undefined) updates.materialId = materialId;
        if (supplierId !== undefined) updates.supplierId = supplierId;
        if (batchNo !== undefined) updates.batchNo = batchNo;
        if (expiryDate !== undefined) updates.expiryDate = expiryDate;
        if (quantityValue !== undefined) updates.quantityValue = Number(quantityValue);
        if (quantityUnit !== undefined) updates.quantityUnit = quantityUnit;
        if (isActive !== undefined) updates.isActive = Boolean(isActive);

        const material = stock.material || (materialId ? await Material.findByPk(materialId) : null);
        let branchMin = null;
        if (material) {
            const effectiveMaterialId = materialId || stock.materialId;
            const effectiveBranchId = branchId || stock.branchId;
            branchMin = await MaterialBranch.findOne({
                where: { materialId: effectiveMaterialId, branchId: effectiveBranchId },
            });
        }
        const minStock = branchMin
            ? Number(branchMin.minStockValue) || 0
            : (material ? Number(material.minStockValue) || 0 : 0);
        updates.status = computeStockStatus(
            updates.quantityValue !== undefined ? updates.quantityValue : stock.quantityValue,
            updates.expiryDate !== undefined ? updates.expiryDate : stock.expiryDate,
            minStock
        );
        await stock.update(updates);

        const out = (await StockItem.findByPk(stock.id, {
            include: [
                { model: Material, as: 'material', attributes: ['id', 'name', 'category', 'unit'] },
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
            ],
        })).toJSON();
        out.materialName = out.material?.name;
        out.category = out.material?.category;
        out.supplierName = out.supplier?.name;
        const mbMapUp = await loadMaterialBranchMapForStockRows([out]);
        applyDerivedStockFields(out, mbMapUp);
        delete out.material;
        delete out.supplier;
        res.json(out);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteStock = async (req, res) => {
    try {
        const stock = await StockItem.findByPk(req.params.id);
        if (!stock) return res.status(404).json({ message: 'Stock item not found' });
        await stock.update({ isActive: false });
        res.json({ message: 'Stock item deactivated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Import stocks from file (e.g. Excel/CSV). Stub: accepts multipart file, returns summary.
 */
exports.importStocks = async (req, res) => {
    try {
        console.log('[stocks:import] hit', {
            userId: req.user?.id,
            ip: req.ip,
        });
        if (!req.file) {
            console.warn('[stocks:import] missing file');
            return res.status(400).json({ message: 'File is required (field name: file)' });
        }
        const originalName = req.file.originalname || '';
        console.log('[stocks:import] file received', { originalName, size: req.file.size });
        if (!originalName.toLowerCase().endsWith('.csv')) {
            return res.status(400).json({ message: 'Only CSV import is supported. Please upload a .csv file.' });
        }

        let rows;
        try {
            rows = await parseCsvBuffer(req.file.buffer);
        } catch (e) {
            console.warn('[stocks:import] csv parse error', e);
            return res.status(400).json({ message: `Invalid CSV format: ${e.message}` });
        }
        if (!rows.length) {
            console.warn('[stocks:import] no data rows');
            return res.status(400).json({
                message: 'Import failed: file contains no data rows',
                created: 0,
                updated: 0,
                failedRows: [],
                warnings: [],
            });
        }
        console.log('[stocks:import] parsed rows', { count: rows.length });

        // Required: branchId, materialId, supplierId, quantityValue
        // Optional: quantityUnit, batchNo, expiryDate
        const requiredCols = ['branchId', 'materialId', 'supplierId', 'quantityValue'];
        const headerKeys = Object.keys(rows[0] || {});
        for (const col of requiredCols) {
            if (!headerKeys.includes(col)) {
                return res.status(400).json({ message: `Invalid CSV format: missing required column '${col}'` });
            }
        }

        const allowedUnits = new Set(['kg', 'g', 'pieces']);
        const failedRows = [];
        const warnings = [];
        const valid = [];

        // prefetch active branches (for allBranches=true materials we may still validate branch existence)
        const [branches, materials, suppliers] = await Promise.all([
            Branch.findAll({ attributes: ['id'] }),
            Material.findAll({ attributes: ['id', 'unit', 'allBranches', 'minStockValue', 'minStockUnit', 'isActive'] }),
            Supplier.findAll({ attributes: ['id'] }),
        ]);

        const branchSet = new Set(branches.map((b) => b.id));
        const supplierSet = new Set(suppliers.map((s) => s.id));
        const materialMap = new Map(materials.map((m) => [m.id, m]));

        // Load all material_branch rows for quick validation and min lookup
        const materialBranchRows = await MaterialBranch.findAll({ attributes: ['materialId', 'branchId', 'minStockValue', 'minStockUnit'] });
        const materialBranchMap = new Map(materialBranchRows.map((mb) => [`${mb.materialId}:${mb.branchId}`, mb]));

        // CSV parser doesn't provide row numbers; header is row 1, first data row is row 2
        rows.forEach((row, idx) => {
            const rowNumber = idx + 2;

            const branchId = parseInt(String(row.branchId).trim(), 10);
            const materialId = parseInt(String(row.materialId).trim(), 10);
            const supplierId = parseInt(String(row.supplierId).trim(), 10);
            const quantityValue = Number(String(row.quantityValue).trim());

            if (!Number.isInteger(branchId) || !branchSet.has(branchId)) {
                failedRows.push({ rowNumber, reason: `Invalid or unknown branchId: '${row.branchId}'`, raw: row });
                return;
            }
            if (!Number.isInteger(materialId) || !materialMap.has(materialId)) {
                failedRows.push({ rowNumber, reason: `Invalid or unknown materialId: '${row.materialId}'`, raw: row });
                return;
            }
            if (!Number.isInteger(supplierId) || !supplierSet.has(supplierId)) {
                failedRows.push({ rowNumber, reason: `Invalid or unknown supplierId: '${row.supplierId}'`, raw: row });
                return;
            }
            if (!Number.isFinite(quantityValue) || quantityValue < 0) {
                failedRows.push({ rowNumber, reason: `Invalid quantityValue: '${row.quantityValue}'`, raw: row });
                return;
            }

            const material = materialMap.get(materialId);
            if (material && material.isActive === false) {
                failedRows.push({ rowNumber, reason: `Material is inactive: '${materialId}'`, raw: row });
                return;
            }

            // No hard-fail if material_branches is missing. We will fall back to material global min / 0.
            if (material && material.allBranches === false) {
                const key = `${materialId}:${branchId}`;
                if (!materialBranchMap.has(key)) {
                    warnings.push({
                        rowNumber,
                        reason: 'No branch min stock found; used material global min / 0 fallback',
                        raw: row,
                    });
                }
            }

            const batchNo = row.batchNo != null && String(row.batchNo).trim() !== '' ? String(row.batchNo).trim() : null;
            if (batchNo && batchNo.length > 64) {
                failedRows.push({ rowNumber, reason: 'Invalid batchNo: too long (max 64 chars)', raw: row });
                return;
            }

            const expiryDate = row.expiryDate != null && String(row.expiryDate).trim() !== '' ? String(row.expiryDate).trim() : null;
            if (expiryDate && !isValidIsoDate(expiryDate)) {
                failedRows.push({ rowNumber, reason: `Invalid expiryDate (expected YYYY-MM-DD): '${row.expiryDate}'`, raw: row });
                return;
            }

            let quantityUnit = normalizeUnit(row.quantityUnit);
            if (!quantityUnit) {
                quantityUnit = normalizeUnit(material.unit) || 'pieces';
            }
            if (!allowedUnits.has(quantityUnit)) {
                failedRows.push({ rowNumber, reason: `Invalid quantityUnit: '${row.quantityUnit}'`, raw: row });
                return;
            }

            // Upsert uniqueness rule:
            // - if batchNo exists: (branchId, materialId, batchNo)
            // - else: (branchId, materialId, supplierId, expiryDate) but expiryDate must be present
            if (!batchNo && !expiryDate) {
                failedRows.push({ rowNumber, reason: 'batchNo is required when expiryDate is empty (to avoid duplicate imports)', raw: row });
                return;
            }

            valid.push({
                branchId,
                materialId,
                supplierId,
                batchNo,
                expiryDate,
                quantityValue,
                quantityUnit,
            });
        });

        let created = 0;
        let updated = 0;

        await sequelize.transaction(async (t) => {
            for (const v of valid) {
                const where = v.batchNo
                    ? { branchId: v.branchId, materialId: v.materialId, batchNo: v.batchNo }
                    : { branchId: v.branchId, materialId: v.materialId, supplierId: v.supplierId, expiryDate: v.expiryDate };

                const existing = await StockItem.findOne({ where, transaction: t });

                // get min stock for status computation
                const minStock = getEffectiveMinStock(v.materialId, v.branchId, materialMap, materialBranchMap);
                const status = computeStockStatus(v.quantityValue, v.expiryDate, minStock);

                if (existing) {
                    await existing.update({
                        supplierId: v.supplierId,
                        expiryDate: v.expiryDate,
                        quantityValue: v.quantityValue,
                        quantityUnit: v.quantityUnit,
                        batchNo: v.batchNo,
                        status,
                        isActive: true,
                    }, { transaction: t });
                    updated += 1;
                } else {
                    await StockItem.create({
                        ...v,
                        status,
                        isActive: true,
                    }, { transaction: t });
                    created += 1;
                }
            }
        });

        console.log('[stocks:import] summary', {
            created,
            updated,
            failed: failedRows.length,
            totalRows: rows.length,
            validRows: valid.length,
        });

        if (created + updated > 0) {
            return res.status(200).json({
                message: 'Import completed',
                created,
                updated,
                failedRows,
                warnings,
            });
        }

        if (failedRows.length > 0) {
            return res.status(400).json({
                message: 'Import failed: no rows were applied',
                created: 0,
                updated: 0,
                failedRows,
                warnings,
            });
        }

        return res.status(400).json({
            message: 'Import failed: no rows were applied',
            created: 0,
            updated: 0,
            failedRows: [{ rowNumber: 1, reason: 'No valid rows to import', raw: {} }],
            warnings,
        });
    } catch (error) {
        console.error('[stocks:import] unexpected error', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getStockImportTemplate = async (req, res) => {
    try {
        const headers = ['branchId', 'materialId', 'supplierId', 'quantityValue', 'quantityUnit', 'batchNo', 'expiryDate'];
        const csv = `${headers.join(',')}\r\n`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=stocks-import-template.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Export stocks as CSV with current filters. Stub: returns CSV with same filters as list.
 */
exports.exportStocks = async (req, res) => {
    try {
        const { branchId, category, status, includeInactive } = req.query;
        const baseWhere = {};
        if (includeInactive !== 'true') baseWhere.isActive = true;
        if (branchId && branchId !== 'all') baseWhere.branchId = branchId;

        const localToday = getLocalCalendarTodayYYYYMMDD();
        let where = { ...baseWhere };
        if (status && status !== 'all' && ['available', 'low', 'out', 'expired'].includes(status)) {
            if (status === 'expired') {
                where = {
                    [Op.and]: [
                        baseWhere,
                        {
                            [Op.or]: [
                                {
                                    [Op.and]: [
                                        { expiryDate: { [Op.ne]: null } },
                                        { expiryDate: { [Op.lt]: localToday } },
                                    ],
                                },
                                { status: 'expired' },
                            ],
                        },
                    ],
                };
            } else {
                where = {
                    [Op.and]: [
                        baseWhere,
                        { status },
                        {
                            [Op.or]: [
                                { expiryDate: null },
                                { expiryDate: { [Op.gte]: localToday } },
                            ],
                        },
                    ],
                };
            }
        }

        const rows = await StockItem.findAll({
            where,
            include: [
                { model: Material, as: 'material', attributes: ['id', 'name', 'category', 'unit', 'minStockValue'] },
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
        });

        let list = rows.map((r) => r.toJSON());
        if (category && category !== 'all') {
            list = list.filter((r) => r.material && r.material.category === category);
        }
        const mbMap = await loadMaterialBranchMapForStockRows(list);
        list.forEach((r) => applyDerivedStockFields(r, mbMap));

        const headers = ['id', 'materialName', 'category', 'supplierName', 'branchId', 'batchNo', 'expiryDate', 'quantityValue', 'quantityUnit', 'status', 'expired'];
        const csvLines = [
            headers.join(','),
            ...list.map((row) => {
                const m = row.material;
                const s = row.supplier;
                return [
                    row.id,
                    (m && m.name) || '',
                    (m && m.category) || '',
                    (s && s.name) || '',
                    row.branchId,
                    row.batchNo || '',
                    row.expiryDate || '',
                    row.quantityValue,
                    row.quantityUnit || '',
                    row.status,
                    row.expired ? 'true' : 'false',
                ].map((cell) => (typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) ? `"${String(cell).replace(/"/g, '""')}"` : cell)).join(',');
            }),
        ];
        const csv = csvLines.join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=stocks-export-${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
