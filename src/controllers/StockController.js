const { Op } = require('sequelize');
const StockItem = require('../models/StockItem');
const Material = require('../models/Material');
const Supplier = require('../models/Supplier');
const Branch = require('../models/Branch');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Compute stock status from quantity, expiry and material's minStockValue.
 */
function computeStatus(quantityValue, expiryDate, minStockValue) {
    const q = Number(quantityValue) || 0;
    const min = Number(minStockValue) || 0;
    const today = new Date().toISOString().slice(0, 10);
    if (expiryDate && String(expiryDate).slice(0, 10) < today) return 'expired';
    if (q <= 0) return 'out';
    if (min > 0 && q < min) return 'low';
    return 'available';
}

/**
 * List stock items with material name, supplier name, category; filters q, branchId, category, status; pagination.
 */
exports.listStocks = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE));
        const { q, branchId, category, status } = req.query;

        const where = {};
        if (branchId && branchId !== 'all' && branchId !== '') {
            where.branchId = branchId;
        }
        if (status && status !== 'all' && ['available', 'low', 'out', 'expired'].includes(status)) {
            where.status = status;
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

        const data = rows.map((row) => {
            const s = row.toJSON();
            s.materialName = s.material?.name;
            s.category = s.material?.category;
            s.supplierName = s.supplier?.name;
            s.expired = s.expiryDate ? s.expiryDate < new Date().toISOString().slice(0, 10) : false;
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
        s.materialName = s.material?.name;
        s.category = s.material?.category;
        s.supplierName = s.supplier?.name;
        s.expired = s.expiryDate ? s.expiryDate < new Date().toISOString().slice(0, 10) : false;
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
        const status = computeStatus(qty, expiryDate, material.minStockValue);

        const stock = await StockItem.create({
            branchId,
            materialId,
            supplierId,
            batchNo: batchNo || null,
            expiryDate: expiryDate || null,
            quantityValue: qty,
            quantityUnit: quantityUnit || material.minStockUnit || 'pieces',
            status,
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
        out.expired = out.expiryDate ? out.expiryDate < new Date().toISOString().slice(0, 10) : false;
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

        const { branchId, materialId, supplierId, batchNo, expiryDate, quantityValue, quantityUnit } = req.body;
        const updates = {};
        if (branchId !== undefined) updates.branchId = branchId;
        if (materialId !== undefined) updates.materialId = materialId;
        if (supplierId !== undefined) updates.supplierId = supplierId;
        if (batchNo !== undefined) updates.batchNo = batchNo;
        if (expiryDate !== undefined) updates.expiryDate = expiryDate;
        if (quantityValue !== undefined) updates.quantityValue = Number(quantityValue);
        if (quantityUnit !== undefined) updates.quantityUnit = quantityUnit;

        const material = stock.material || (materialId ? await Material.findByPk(materialId) : null);
        const minStock = material ? Number(material.minStockValue) || 0 : 0;
        updates.status = computeStatus(
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
        out.expired = out.expiryDate ? out.expiryDate < new Date().toISOString().slice(0, 10) : false;
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
        await stock.destroy();
        res.json({ message: 'Stock item deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Import stocks from file (e.g. Excel/CSV). Stub: accepts multipart file, returns summary.
 */
exports.importStocks = async (req, res) => {
    try {
        if (!req.file && !req.files?.file) {
            return res.status(400).json({ message: 'No file uploaded. Send multipart/form-data with a file field.' });
        }
        const file = req.file || req.files?.file;
        // TODO: parse file (xlsx/csv), validate rows, create/update StockItem, collect errors
        res.status(200).json({
            message: 'Import endpoint ready; parsing not yet implemented',
            created: 0,
            updated: 0,
            failedRows: [],
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Export stocks as CSV with current filters. Stub: returns CSV with same filters as list.
 */
exports.exportStocks = async (req, res) => {
    try {
        const { branchId, category, status } = req.query;
        const where = {};
        if (branchId && branchId !== 'all') where.branchId = branchId;
        if (status && status !== 'all') where.status = status;

        const rows = await StockItem.findAll({
            where,
            include: [
                { model: Material, as: 'material', attributes: ['id', 'name', 'category', 'unit'] },
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
        });

        let list = rows;
        if (category && category !== 'all') {
            list = rows.filter((r) => r.material && r.material.category === category);
        }

        const headers = ['id', 'materialName', 'category', 'supplierName', 'branchId', 'batchNo', 'expiryDate', 'quantityValue', 'quantityUnit', 'status'];
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
