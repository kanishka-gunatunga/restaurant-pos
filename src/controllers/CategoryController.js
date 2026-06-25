const Category = require('../models/Category');
const sequelize = require('../config/database');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');
const xlsx = require('xlsx');

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
        if (transaction && !transaction.finished) await transaction.rollback();
        console.error('Create Category Error:', error);
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
        if (transaction && !transaction.finished) await transaction.rollback();
        console.error('Update Category Error:', error);
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

exports.exportTemplate = async (req, res) => {
    try {
        const wb = xlsx.utils.book_new();

        // Sheet 1: Categories
        const categoriesWs = xlsx.utils.aoa_to_sheet([
            ['Category Name', 'Subcategories (Comma Separated)', 'Status'],
            ['Fast Food', 'Burgers, Fries, Hot Dogs', 'active'],
            ['Italian', 'Pizza, Pasta, Salads', 'active'],
            ['Beverages', 'Soft Drinks, Hot Drinks', 'active']
        ]);
        categoriesWs['!cols'] = [
            { wch: 25 }, { wch: 50 }, { wch: 10 }
        ];
        
        xlsx.utils.book_append_sheet(wb, categoriesWs, 'Categories');

        const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=category_import_template.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Exported Category Template',
            description: `User downloaded the category import template`,
            metadata: {}
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.importCategories = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const t = await sequelize.transaction();
    try {
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        
        const categoriesSheet = wb.Sheets['Categories'];

        if (!categoriesSheet) {
            throw new Error('Invalid Excel file format. Missing required sheet: "Categories"');
        }

        const categoriesData = xlsx.utils.sheet_to_json(categoriesSheet);

        let createdCategoriesCount = 0;
        let createdSubCategoriesCount = 0;

        for (const cRow of categoriesData) {
            const catName = cRow['Category Name'];
            if (!catName) continue;

            const existingCategory = await Category.findOne({ 
                where: { 
                    parentId: null,
                    name: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), catName.toLowerCase())
                }, 
                transaction: t 
            });

            let parentCategory = existingCategory;
            if (!parentCategory) {
                parentCategory = await Category.create({
                    name: catName,
                    parentId: null,
                    status: cRow['Status'] || 'active'
                }, { transaction: t });
                createdCategoriesCount++;
            }

            // Process Subcategories
            const subcategoriesStr = cRow['Subcategories (Comma Separated)'];
            if (subcategoriesStr !== undefined && subcategoriesStr !== null) {
                const subNames = subcategoriesStr.toString().split(',').map(s => s.trim());
                for (const sName of subNames) {
                    if (sName) {
                        let existingSubCategory = await Category.findOne({ 
                            where: {
                                parentId: parentCategory.id,
                                name: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), sName.toLowerCase())
                            }, 
                            transaction: t 
                        });
                        
                        if (!existingSubCategory) {
                            await Category.create({ 
                                name: sName,
                                parentId: parentCategory.id,
                                status: cRow['Status'] || 'active'
                            }, { transaction: t });
                            createdSubCategoriesCount++;
                        }
                    }
                }
            }
        }

        await t.commit();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Imported Categories via Excel',
            description: `Imported ${createdCategoriesCount} categories and ${createdSubCategoriesCount} subcategories`,
            metadata: { createdCategoriesCount, createdSubCategoriesCount }
        });

        res.status(200).json({ message: `Successfully imported ${createdCategoriesCount} new categories and ${createdSubCategoriesCount} new subcategories.` });
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        console.error('Import Category Error:', error);
        res.status(400).json({ message: error.message || 'Error parsing Excel file' });
    }
};
