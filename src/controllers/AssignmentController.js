const { Op } = require('sequelize');
const ProductAssignment = require('../models/ProductAssignment');
const Material = require('../models/Material');
const Product = require('../models/Product');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Enrich materialsUsed with materialName from DB when materialId is present.
 */
async function enrichMaterialsUsed(materialsUsed) {
    if (!Array.isArray(materialsUsed) || materialsUsed.length === 0) return materialsUsed;
    const ids = [...new Set(materialsUsed.map((m) => m.materialId).filter(Boolean))];
    const materials = await Material.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name'] });
    const byId = Object.fromEntries(materials.map((m) => [m.id, m.name]));
    return materialsUsed.map((m) => ({
        ...m,
        materialName: m.materialName || (m.materialId ? byId[m.materialId] : null),
    }));
}

exports.listAssignments = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE));
        const { q, branchId } = req.query;

        const where = {};
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
                a.materialsUsed = await enrichMaterialsUsed(a.materialsUsed || []);
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
        a.materialsUsed = await enrichMaterialsUsed(a.materialsUsed || []);
        res.json(a);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createAssignment = async (req, res) => {
    try {
        const { branchId, productId, productName, batchNo, expiryDate, quantity, quantityUnit, materialsUsed } = req.body;
        if (!branchId || !productName) {
            return res.status(400).json({ message: 'branchId and productName are required' });
        }
        const payload = {
            branchId,
            productId: productId || null,
            productName,
            batchNo: batchNo || null,
            expiryDate: expiryDate || null,
            quantity: Number(quantity) ?? 0,
            quantityUnit: quantityUnit || 'items',
            materialsUsed: Array.isArray(materialsUsed) ? materialsUsed : [],
        };
        const assignment = await ProductAssignment.create(payload);
        const a = assignment.toJSON();
        a.materialsUsed = await enrichMaterialsUsed(a.materialsUsed || []);
        res.status(201).json(a);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateAssignment = async (req, res) => {
    try {
        const assignment = await ProductAssignment.findByPk(req.params.id);
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        const { branchId, productId, productName, batchNo, expiryDate, quantity, quantityUnit, materialsUsed } = req.body;
        await assignment.update({
            ...(branchId !== undefined && { branchId }),
            ...(productId !== undefined && { productId }),
            ...(productName !== undefined && { productName }),
            ...(batchNo !== undefined && { batchNo }),
            ...(expiryDate !== undefined && { expiryDate }),
            ...(quantity !== undefined && { quantity: Number(quantity) }),
            ...(quantityUnit !== undefined && { quantityUnit }),
            ...(materialsUsed !== undefined && { materialsUsed: Array.isArray(materialsUsed) ? materialsUsed : [] }),
        });
        const a = assignment.toJSON();
        a.materialsUsed = await enrichMaterialsUsed(a.materialsUsed || []);
        res.json(a);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteAssignment = async (req, res) => {
    try {
        const assignment = await ProductAssignment.findByPk(req.params.id);
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
        await assignment.destroy();
        res.json({ message: 'Assignment deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
