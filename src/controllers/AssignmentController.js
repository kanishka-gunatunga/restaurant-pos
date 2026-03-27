const { Op } = require('sequelize');
const sequelize = require('../config/database');
const ProductAssignment = require('../models/ProductAssignment');
const Material = require('../models/Material');
const Product = require('../models/Product');
const {
    consumeForAssignment,
    restoreForAssignment,
    roundQty3,
    attachStockSnapshotsToLines,
} = require('../utils/assignmentStockConsumption');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * DB (MySQL JSON) and clients may expose materials as a real array, a JSON string, or a single object.
 * Without this, enrichMaterialsUsed treated non-arrays as empty and the list/detail column stayed blank.
 */
function coalesceMaterialsUsedArray(value) {
    if (value == null || value === '') return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        const s = value.trim();
        if (!s) return [];
        try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return [parsed];
        } catch {
            return [];
        }
        return [];
    }
    if (typeof value === 'object') {
        if (
            'materialId' in value ||
            'material_id' in value ||
            'qtyValue' in value ||
            'qty_value' in value
        ) {
            return [value];
        }
    }
    return [];
}

function normalizeMaterialItem(m, byId = new Map()) {
    const rawId = m.materialId ?? m.material_id;
    const id = typeof rawId === 'number' ? rawId : parseInt(rawId, 10);
    const materialId = Number.isNaN(id) ? rawId : id;
    const rawStock = m.stockId ?? m.stock_id;
    let stockId = null;
    if (rawStock !== undefined && rawStock !== null && String(rawStock).trim() !== '') {
        const sid = typeof rawStock === 'number' ? rawStock : parseInt(String(rawStock), 10);
        stockId = Number.isFinite(sid) && !Number.isNaN(sid) ? sid : null;
    }
    const materialName =
        typeof id === 'number' && !Number.isNaN(id) && byId.has(id)
            ? byId.get(id)
            : (m.materialName ?? m.material_name ?? null);
    const line = {
        materialId,
        materialName,
        stockId,
        qtyValue: Number(m.qtyValue ?? m.qty_value ?? 0),
        qtyUnit: String(m.qtyUnit ?? m.qty_unit ?? 'pieces'),
    };
    if (m.stockBatchNo != null || m.stock_batch_no != null) {
        line.stockBatchNo = m.stockBatchNo ?? m.stock_batch_no;
    }
    if (m.stockExpiryDate != null || m.stock_expiry_date != null) {
        line.stockExpiryDate = m.stockExpiryDate ?? m.stock_expiry_date;
    }
    return line;
}

async function enrichMaterialsUsed(materialsUsedRaw) {
    const materialsUsed = coalesceMaterialsUsedArray(materialsUsedRaw);
    if (materialsUsed.length === 0) return [];
    const rawIds = materialsUsed.map((m) => m.materialId ?? m.material_id).filter(Boolean);
    const ids = [
        ...new Set(rawIds.map((x) => (typeof x === 'number' ? x : parseInt(x, 10)))),
    ].filter((n) => !Number.isNaN(n));
    if (ids.length === 0) return materialsUsed.map((m) => normalizeMaterialItem(m));
    const materials = await Material.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name'] });
    const byId = new Map(materials.map((mat) => [mat.id, mat.name]));
    return materialsUsed.map((m) => normalizeMaterialItem(m, byId));
}

function validateActiveAssignmentMaterials(normalized) {
    for (const line of normalized) {
        if (roundQty3(line.qtyValue) > 0 && line.stockId == null) {
            return 'Each materialsUsed line with quantity must include stockId (inventory batch line)';
        }
    }
    return null;
}

function httpFromError(err, res) {
    const code = err.statusCode;
    if (code === 400 || code === 409) {
        return res.status(code).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message });
}

/**
 * GET /api/supply/assignments
 */
exports.listAssignments = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE));
        const { q, branchId, includeInactive } = req.query;

        const where = {};
        if (includeInactive !== 'true') {
            where.isActive = true;
        }
        if (branchId && branchId !== 'all' && branchId !== '') {
            where.branchId = branchId;
        }
        if (q && String(q).trim()) {
            where.productName = { [Op.like]: `%${String(q).trim()}%` };
        }

        const { count, rows } = await ProductAssignment.findAndCountAll({
            where,
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'], required: false }],
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
        });

        const data = await Promise.all(
            rows.map(async (row) => {
                const a = row.toJSON();
                if (a.product) a.productId = a.product.id;
                delete a.product;
                const rawMat = a.materialsUsed ?? a.materials_used;
                a.materialsUsed = await enrichMaterialsUsed(rawMat);
                if (Object.prototype.hasOwnProperty.call(a, 'materials_used')) {
                    delete a.materials_used;
                }
                return a;
            })
        );

        res.json({ data, meta: { total: count, page, pageSize } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAssignmentById = async (req, res) => {
    try {
        const assignment = await ProductAssignment.findByPk(req.params.id);
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
        const a = assignment.toJSON();
        const rawMat = a.materialsUsed ?? a.materials_used;
        a.materialsUsed = await enrichMaterialsUsed(rawMat);
        if (Object.prototype.hasOwnProperty.call(a, 'materials_used')) {
            delete a.materials_used;
        }
        res.json(a);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createAssignment = async (req, res) => {
    try {
        const {
            branchId,
            productId,
            productName,
            batchNo,
            expiryDate,
            quantity,
            quantityUnit,
            materialsUsed,
            isActive: bodyIsActive,
        } = req.body;
        if (!branchId || !productName) {
            return res.status(400).json({ message: 'branchId and productName are required' });
        }

        const isActive = bodyIsActive !== false;
        const normalized = await enrichMaterialsUsed(materialsUsed);

        if (isActive) {
            const v = validateActiveAssignmentMaterials(normalized);
            if (v) return res.status(400).json({ message: v });
        }

        let created;
        try {
            await sequelize.transaction(async (t) => {
                if (isActive) {
                    await consumeForAssignment(normalized, Number(branchId), t);
                }
                const toSave = await attachStockSnapshotsToLines(normalized, t);
                created = await ProductAssignment.create(
                    {
                        branchId,
                        productId: productId || null,
                        productName,
                        batchNo: batchNo || null,
                        expiryDate: expiryDate || null,
                        quantity: Number(quantity) ?? 0,
                        quantityUnit: quantityUnit || 'items',
                        materialsUsed: toSave,
                        isActive,
                    },
                    { transaction: t }
                );
            });
        } catch (err) {
            return httpFromError(err, res);
        }

        const a = created.toJSON();
        const rawMat = a.materialsUsed ?? a.materials_used;
        a.materialsUsed = await enrichMaterialsUsed(rawMat);
        if (Object.prototype.hasOwnProperty.call(a, 'materials_used')) {
            delete a.materials_used;
        }
        res.status(201).json(a);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateAssignment = async (req, res) => {
    try {
        const assignment = await ProductAssignment.findByPk(req.params.id);
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        const prevActive = assignment.isActive;
        const prevRaw =
            assignment.get('materialsUsed') ?? assignment.get('materials_used');
        const prevNormalized = await enrichMaterialsUsed(prevRaw);

        const {
            branchId,
            productId,
            productName,
            batchNo,
            expiryDate,
            quantity,
            quantityUnit,
            materialsUsed,
            isActive: bodyIsActive,
        } = req.body;

        const nextActive = bodyIsActive !== undefined ? Boolean(bodyIsActive) : prevActive;
        const effectiveBranchId =
            branchId !== undefined ? Number(branchId) : assignment.branchId;

        let nextNormalized;
        if (materialsUsed !== undefined) {
            nextNormalized = await enrichMaterialsUsed(materialsUsed);
        } else {
            nextNormalized = prevNormalized;
        }

        try {
            await sequelize.transaction(async (t) => {
                if (prevActive) {
                    await restoreForAssignment(prevNormalized, t);
                }
                if (nextActive) {
                    await consumeForAssignment(nextNormalized, effectiveBranchId, t);
                }

                const updatePayload = {
                    ...(branchId !== undefined && { branchId }),
                    ...(productId !== undefined && { productId }),
                    ...(productName !== undefined && { productName }),
                    ...(batchNo !== undefined && { batchNo }),
                    ...(expiryDate !== undefined && { expiryDate }),
                    ...(quantity !== undefined && { quantity: Number(quantity) }),
                    ...(quantityUnit !== undefined && { quantityUnit }),
                    ...(bodyIsActive !== undefined && { isActive: nextActive }),
                };

                if (materialsUsed !== undefined) {
                    updatePayload.materialsUsed = await attachStockSnapshotsToLines(nextNormalized, t);
                }

                await assignment.update(updatePayload, { transaction: t });
            });
        } catch (err) {
            return httpFromError(err, res);
        }

        await assignment.reload();
        const a = assignment.toJSON();
        const rawMatUp = a.materialsUsed ?? a.materials_used;
        a.materialsUsed = await enrichMaterialsUsed(rawMatUp);
        if (Object.prototype.hasOwnProperty.call(a, 'materials_used')) {
            delete a.materials_used;
        }
        res.json(a);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteAssignment = async (req, res) => {
    try {
        const assignment = await ProductAssignment.findByPk(req.params.id);
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        if (!assignment.isActive) {
            await assignment.update({ isActive: false });
            return res.json({ message: 'Assignment deactivated' });
        }

        const prevDelRaw =
            assignment.get('materialsUsed') ?? assignment.get('materials_used');
        const prevNormalized = await enrichMaterialsUsed(prevDelRaw);

        try {
            await sequelize.transaction(async (t) => {
                await restoreForAssignment(prevNormalized, t);
                await assignment.update({ isActive: false }, { transaction: t });
            });
        } catch (err) {
            return httpFromError(err, res);
        }

        res.json({ message: 'Assignment deactivated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
