const { Op } = require('sequelize');
const Supplier = require('../models/Supplier');
const Branch = require('../models/Branch');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Build where clause for list: search (q) on name, contactPerson, email, phone; branchId; status.
 */
function buildSupplierWhere(query) {
    const { q, branchId, status } = query;
    const where = {};

    if (q && String(q).trim()) {
        const term = `%${String(q).trim()}%`;
        where[Op.or] = [
            { name: { [Op.like]: term } },
            { contactPerson: { [Op.like]: term } },
            { email: { [Op.like]: term } },
            { phone: { [Op.like]: term } },
        ];
    }
    if (branchId && branchId !== 'all' && branchId !== '') {
        where.branchId = query.branchId;
    }
    if (status && status !== 'all' && (status === 'active' || status === 'inactive')) {
        where.status = status;
    }
    return where;
}

exports.listSuppliers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE));
        const where = buildSupplierWhere(req.query);

        const { count, rows } = await Supplier.findAndCountAll({
            where,
            include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'location'] }],
            order: [['name', 'ASC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
        });

        res.json({
            data: rows,
            meta: { total: count, page, pageSize },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getSupplierById = async (req, res) => {
    try {
        const supplier = await Supplier.findByPk(req.params.id, {
            include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'location'] }],
        });
        if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
        res.json(supplier);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createSupplier = async (req, res) => {
    try {
        const {
            name,
            branchId,
            contactPerson,
            email,
            phone,
            status,
            country,
            address,
            taxId,
            paymentTerms,
        } = req.body;

        if (!name || !branchId || !contactPerson || !phone) {
            return res.status(400).json({ message: 'name, branchId, contactPerson and phone are required' });
        }

        const branch = await Branch.findByPk(branchId);
        if (!branch) return res.status(400).json({ message: 'Branch not found' });

        const supplier = await Supplier.create({
            name,
            branchId,
            contactPerson,
            email: email || null,
            phone,
            status: status === 'inactive' ? 'inactive' : 'active',
            country: country || null,
            address: address || null,
            taxId: taxId || null,
            paymentTerms: paymentTerms || null,
        });
        res.status(201).json(supplier);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findByPk(req.params.id);
        if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

        const {
            name,
            branchId,
            contactPerson,
            email,
            phone,
            status,
            country,
            address,
            taxId,
            paymentTerms,
        } = req.body;

        if (branchId != null) {
            const branch = await Branch.findByPk(branchId);
            if (!branch) return res.status(400).json({ message: 'Branch not found' });
        }

        await supplier.update({
            ...(name !== undefined && { name }),
            ...(branchId !== undefined && { branchId }),
            ...(contactPerson !== undefined && { contactPerson }),
            ...(email !== undefined && { email }),
            ...(phone !== undefined && { phone }),
            ...(status !== undefined && (status === 'active' || status === 'inactive') && { status }),
            ...(country !== undefined && { country }),
            ...(address !== undefined && { address }),
            ...(taxId !== undefined && { taxId }),
            ...(paymentTerms !== undefined && { paymentTerms }),
        });
        res.json(supplier);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findByPk(req.params.id);
        if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
        await supplier.destroy();
        res.json({ message: 'Supplier deleted' });
    } catch (error) {
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({ message: 'Cannot delete supplier: linked to existing stock items.' });
        }
        res.status(500).json({ message: error.message });
    }
};
