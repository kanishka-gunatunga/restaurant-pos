const Category = require('../models/Category');

exports.getAllCategories = async (req, res) => {
    try {
        const { status } = req.query;
        let statusFilter = { status: 'active' };

        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const categories = await Category.findAll({
            include: [{
                model: Category,
                as: 'subcategories',
                where: statusFilter,
                required: false
            }],
            where: {
                parentId: null,
                ...statusFilter
            },
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, parentId } = req.body;
        const category = await Category.create({
            name,
            parentId: parentId === '' ? null : parentId
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.update(req.body, { where: { id } });
        res.json({ message: 'Category updated' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deactivateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.update({ status: 'inactive' }, { where: { id } });
        res.json({ message: 'Category deactivated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.activateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.update({ status: 'active' }, { where: { id } });
        res.json({ message: 'Category activated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getParentCategories = async (req, res) => {
    try {
        const { status } = req.query;
        let statusFilter = { status: 'active' };

        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const where = {
            parentId: null,
            ...statusFilter
        };
        const categories = await Category.findAll({ where });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getSubCategories = async (req, res) => {
    try {
        const { parentId } = req.params;
        const { status } = req.query;
        let statusFilter = { status: 'active' };

        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const where = {
            parentId,
            ...statusFilter
        };
        const categories = await Category.findAll({ where });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id, {
            include: [
                {
                    model: Category,
                    as: 'subcategories',
                    required: false
                },
                { model: Category, as: 'parent' }
            ]
        });
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
