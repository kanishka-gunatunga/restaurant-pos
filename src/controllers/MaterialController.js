const { Op } = require('sequelize');
const Material = require('../models/Material');
const MaterialBranch = require('../models/MaterialBranch');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * List materials with optional filters: q (name), category, branchId.
 * branchId filter: include material if allBranches is true OR material has a MaterialBranch for that branch.
 */
exports.listMaterials = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE));
        const { q, category, branchId } = req.query;

        const where = {};
        if (q && String(q).trim()) {
            where.name = { [Op.like]: `%${String(q).trim()}%` };
        }
        if (category && category !== 'all') {
            where.category = category;
        }

        let materialIdsByBranch = null;
        if (branchId && branchId !== 'all' && branchId !== '') {
            const bid = parseInt(branchId, 10);
            if (!Number.isNaN(bid)) {
                const rows = await MaterialBranch.findAll({
                    where: { branchId: bid },
                    attributes: ['materialId'],
                });
                materialIdsByBranch = rows.map((r) => r.materialId);
            }
        }

        const whereClause = { ...where };
        if (materialIdsByBranch !== null) {
            whereClause[Op.or] = [
                { allBranches: true },
                { id: { [Op.in]: materialIdsByBranch.length ? materialIdsByBranch : [0] } },
            ];
        }

        const { count, rows } = await Material.findAndCountAll({
            where: whereClause,
            include: [{ model: MaterialBranch, as: 'materialBranches', attributes: ['branchId'] }],
            order: [['name', 'ASC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
        });

        const data = rows.map((m) => {
            const mat = m.toJSON();
            mat.branchIds = (mat.materialBranches || []).map((mb) => mb.branchId);
            delete mat.materialBranches;
            return mat;
        });

        res.json({ data, meta: { total: count, page, pageSize } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMaterialById = async (req, res) => {
    try {
        const material = await Material.findByPk(req.params.id, {
            include: [{ model: MaterialBranch, as: 'materialBranches', attributes: ['branchId'] }],
        });
        if (!material) return res.status(404).json({ message: 'Material not found' });
        const out = material.toJSON();
        out.branchIds = (out.materialBranches || []).map((mb) => mb.branchId);
        delete out.materialBranches;
        res.json(out);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createMaterial = async (req, res) => {
    try {
        const { name, category, unit, allBranches, branchIds, minStockValue, minStockUnit } = req.body;
        if (!name) return res.status(400).json({ message: 'Name is required' });

        const material = await Material.create({
            name,
            category: category || null,
            unit: unit || 'pieces',
            allBranches: Boolean(allBranches),
            minStockValue: minStockValue != null ? Number(minStockValue) : 0,
            minStockUnit: minStockUnit || 'pieces',
        });

        const bidList = Array.isArray(branchIds) ? branchIds : [];
        if (!material.allBranches && bidList.length > 0) {
            await MaterialBranch.bulkCreate(bidList.map((branchId) => ({ materialId: material.id, branchId })));
        }

        const withBranches = await Material.findByPk(material.id, {
            include: [{ model: MaterialBranch, as: 'materialBranches', attributes: ['branchId'] }],
        });
        const out = withBranches.toJSON();
        out.branchIds = (out.materialBranches || []).map((mb) => mb.branchId);
        delete out.materialBranches;
        res.status(201).json(out);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateMaterial = async (req, res) => {
    try {
        const material = await Material.findByPk(req.params.id);
        if (!material) return res.status(404).json({ message: 'Material not found' });

        const { name, category, unit, allBranches, branchIds, minStockValue, minStockUnit } = req.body;
        await material.update({
            ...(name !== undefined && { name }),
            ...(category !== undefined && { category }),
            ...(unit !== undefined && { unit }),
            ...(allBranches !== undefined && { allBranches: Boolean(allBranches) }),
            ...(minStockValue !== undefined && { minStockValue: Number(minStockValue) }),
            ...(minStockUnit !== undefined && { minStockUnit }),
        });

        if (branchIds !== undefined) {
            await MaterialBranch.destroy({ where: { materialId: material.id } });
            const bidList = Array.isArray(branchIds) ? branchIds : [];
            if (!material.allBranches && bidList.length > 0) {
                await MaterialBranch.bulkCreate(bidList.map((branchId) => ({ materialId: material.id, branchId })));
            }
        }

        const withBranches = await Material.findByPk(material.id, {
            include: [{ model: MaterialBranch, as: 'materialBranches', attributes: ['branchId'] }],
        });
        const out = withBranches.toJSON();
        out.branchIds = (out.materialBranches || []).map((mb) => mb.branchId);
        delete out.materialBranches;
        res.json(out);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteMaterial = async (req, res) => {
    try {
        const material = await Material.findByPk(req.params.id);
        if (!material) return res.status(404).json({ message: 'Material not found' });
        await material.destroy();
        res.json({ message: 'Material deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
