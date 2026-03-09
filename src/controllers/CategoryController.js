const Category = require('../models/Category');
const sequelize = require('../config/database');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');

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
    const transaction = await sequelize.transaction();
    try {
        const { name, subcategories } = req.body;

        // Create the parent category
        const parentCategory = await Category.create({
            name,
            parentId: null
        }, { transaction });

        // Create subcategories if provided
        if (subcategories && Array.isArray(subcategories)) {
            const subcategoriesData = subcategories.map(subName => ({
                name: subName,
                parentId: parentCategory.id
            }));
            await Category.bulkCreate(subcategoriesData, { transaction });
        }

        await transaction.commit();

        // Fetch the created category with its subcategories
        const createdCategory = await Category.findByPk(parentCategory.id, {
            include: [{
                model: Category,
                as: 'subcategories'
            }]
        });

        res.status(201).json(createdCategory);

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Category Created',
            description: `Category ${name} created`,
            metadata: { categoryId: createdCategory.id, name }
        });
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { name, subcategories } = req.body;

        // Update the parent category
        await Category.update({ name }, {
            where: { id },
            transaction
        });

        if (subcategories && Array.isArray(subcategories)) {
            // Get current subcategories
            const currentSubcategories = await Category.findAll({
                where: { parentId: id },
                transaction
            });

            const currentIds = currentSubcategories.map(s => s.id);
            const providedIds = subcategories.filter(s => s.id).map(s => s.id);

            // Subcategories to delete (not in provided list)
            const idsToDelete = currentIds.filter(cid => !providedIds.includes(cid));
            if (idsToDelete.length > 0) {
                await Category.destroy({
                    where: { id: idsToDelete },
                    transaction
                });
            }

            // Sync subcategories
            for (const sub of subcategories) {
                if (sub.id) {
                    // Update existing
                    await Category.update({ name: sub.name }, {
                        where: { id: sub.id, parentId: id },
                        transaction
                    });
                } else {
                    // Create new
                    await Category.create({
                        name: sub.name,
                        parentId: id
                    }, { transaction });
                }
            }
        }

        await transaction.commit();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Category Updated',
            description: `Category ID ${id} updated`,
            metadata: { categoryId: id, name }
        });

        res.json({ message: 'Category and subcategories updated' });
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.deactivateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.update({ status: 'inactive' }, { where: { id } });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Category Deactivated',
            description: `Category ID ${id} deactivated`,
            metadata: { categoryId: id }
        });

        res.json({ message: 'Category deactivated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.activateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.update({ status: 'active' }, { where: { id } });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Category Activated',
            description: `Category ID ${id} activated`,
            metadata: { categoryId: id }
        });

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
