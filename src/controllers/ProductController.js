const { Op } = require('sequelize');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Variation = require('../models/Variation');
const VariationPrice = require('../models/VariationPrice');
const Modification = require('../models/Modification');
const ProductModification = require('../models/ProductModification');
const ProductModificationPrice = require('../models/ProductModificationPrice');
const ProductModificationItemPrice = require('../models/ProductModificationItemPrice');
const ModificationItem = require('../models/ModificationItem');
const ProductBranch = require('../models/ProductBranch');
const VariationOption = require('../models/VariationOption');
const DiscountItem = require('../models/DiscountItem');
const Discount = require('../models/Discount');
const Branch = require('../models/Branch');
const sequelize = require('../config/database');
const { put } = require('@vercel/blob');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');

exports.searchProducts = async (req, res) => {
    try {
        const { query, status } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        let statusFilter = { status: 'active' };
        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const products = await Product.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: `%${query}%` } },
                    { sku: { [Op.like]: `%${query}%` } },
                    { code: { [Op.like]: `%${query}%` } }
                ],
                ...statusFilter
            },
            include: [
                { model: Category, as: 'category', where: statusFilter, required: false },
                { model: Category, as: 'subCategory', required: false },
                { model: ProductBranch, as: 'branches', required: false },
                {
                    model: Variation,
                    as: 'variations',
                    where: statusFilter,
                    required: false,
                    include: [
                        {
                            model: VariationOption,
                            as: 'options',
                            where: statusFilter,
                            required: false,
                            include: [
                                { model: VariationPrice, as: 'prices' },
                                {
                                    model: DiscountItem,
                                    as: 'discountItems',
                                    required: false,
                                    include: [
                                        { model: Discount, required: true, where: { status: 'active' } },
                                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                                    ]
                                }
                            ]
                        },
                        {
                            model: ProductModification,
                            as: 'variationModifications',
                            include: [
                                { model: Modification, where: statusFilter, required: false }
                            ]
                        }
                    ]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification, where: statusFilter, required: false }
                    ]
                },
                {
                    model: DiscountItem,
                    as: 'discountItems',
                    required: false,
                    include: [
                        { model: Discount, required: true, where: { status: 'active' } },
                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                    ]
                }
            ]
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProductsByBranch = async (req, res) => {
    try {
        const { branchId } = req.params;
        const { categoryId, subCategoryId, status } = req.query;

        let statusFilter = { status: 'active' };
        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const where = { ...statusFilter };
        if (categoryId) where.categoryId = categoryId;
        if (subCategoryId) where.subCategoryId = subCategoryId;

        const products = await Product.findAll({
            where,
            include: [
                { model: Category, as: 'category', where: statusFilter, required: false },
                { model: Category, as: 'subCategory', required: false },
                {
                    model: ProductBranch,
                    as: 'branches',
                    where: { branchId },
                    required: true
                },
                {
                    model: Variation,
                    as: 'variations',
                    where: statusFilter,
                    required: true,
                    include: [
                        {
                            model: VariationOption,
                            as: 'options',
                            where: statusFilter,
                            required: true,
                            include: [
                                {
                                    model: VariationPrice,
                                    as: 'prices',
                                    where: { branchId },
                                    required: true
                                },
                                {
                                    model: DiscountItem,
                                    as: 'discountItems',
                                    required: false,
                                    where: {
                                        [Op.or]: [
                                            { branchId: null },
                                            { branchId }
                                        ]
                                    },
                                    include: [
                                        { model: Discount, required: true, where: { status: 'active' } },
                                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                                    ]
                                }
                            ]
                        },
                        {
                            model: ProductModification,
                            as: 'variationModifications',
                            include: [
                                { model: Modification, where: statusFilter, required: false }
                            ]
                        }
                    ]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification, where: statusFilter, required: false }
                    ]
                },
                {
                    model: DiscountItem,
                    as: 'discountItems',
                    required: false,
                    where: {
                        [Op.or]: [
                            { branchId: null },
                            { branchId }
                        ]
                    },
                    include: [
                        { model: Discount, required: true, where: { status: 'active' } },
                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                    ]
                }
            ]
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllProducts = async (req, res) => {
    try {
        const { categoryId, subCategoryId, status } = req.query;

        let statusFilter = { status: 'active' };
        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const where = { ...statusFilter };
        if (categoryId) where.categoryId = categoryId;
        if (subCategoryId) where.subCategoryId = subCategoryId;

        const products = await Product.findAll({
            where,
            include: [
                { model: Category, as: 'category', where: statusFilter, required: false },
                { model: Category, as: 'subCategory', required: false },
                { model: ProductBranch, as: 'branches', required: false },
                {
                    model: Variation,
                    as: 'variations',
                    where: statusFilter,
                    required: false,
                    include: [
                        {
                            model: VariationOption,
                            as: 'options',
                            where: statusFilter,
                            required: false,
                            include: [
                                { model: VariationPrice, as: 'prices' },
                                {
                                    model: DiscountItem,
                                    as: 'discountItems',
                                    required: false,
                                    include: [
                                        { model: Discount, required: true, where: { status: 'active' } },
                                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                                    ]
                                }
                            ]
                        },
                        {
                            model: ProductModification,
                            as: 'variationModifications',
                            include: [
                                { model: Modification, where: statusFilter, required: false }
                            ]
                        }
                    ]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification, where: statusFilter, required: false }
                    ]
                },
                {
                    model: DiscountItem,
                    as: 'discountItems',
                    required: false,
                    include: [
                        { model: Discount, required: true, where: { status: 'active' } },
                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                    ]
                }
            ]
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByPk(id, {
            include: [
                { model: Category, as: 'category', required: false },
                { model: Category, as: 'subCategory', required: false },
                { model: ProductBranch, as: 'branches', required: false },
                {
                    model: Variation,
                    as: 'variations',
                    required: false,
                    include: [
                        {
                            model: VariationOption,
                            as: 'options',
                            required: false,
                            include: [
                                { model: VariationPrice, as: 'prices' },
                                {
                                    model: DiscountItem,
                                    as: 'discountItems',
                                    required: false,
                                    include: [
                                        { model: Discount, required: true, where: { status: 'active' } },
                                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                                    ]
                                }
                            ]
                        },
                        {
                            model: ProductModification,
                            as: 'variationModifications',
                            include: [
                                { model: Modification, required: false }
                            ]
                        }
                    ]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification, required: false }
                    ]
                },
                {
                    model: DiscountItem,
                    as: 'discountItems',
                    required: false,
                    include: [
                        { model: Discount, required: true, where: { status: 'active' } },
                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                    ]
                }
            ]
        });

        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createProduct = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const productData = req.body;
        let imageUrl = null;

        if (req.file) {
            const blob = await put(`products/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN
            });
            imageUrl = blob.url;
        }

        let {
            name, code, shortDescription, description, sku, categoryId, subCategoryId,
            variations, modifications, branches
        } = productData;

        // Parse JSON strings if they come from multipart/form-data
        if (typeof branches === 'string') branches = JSON.parse(branches);
        if (typeof variations === 'string') variations = JSON.parse(variations);
        if (typeof modifications === 'string') modifications = JSON.parse(modifications);

        // 1. Create base product
        const product = await Product.create({
            name, code, image: imageUrl, shortDescription, description, sku, categoryId, subCategoryId, status: 'active'
        }, { transaction: t });

        // 1.5. Create Product Branches
        if (branches && branches.length > 0) {
            for (const branchId of branches) {
                await ProductBranch.create({
                    productId: product.id,
                    branchId
                }, { transaction: t });
            }
        }

        // 2. Create variations, options, and prices
        if (variations && variations.length > 0) {
            for (const v of variations) {
                const variation = await Variation.create({
                    productId: product.id,
                    name: v.name,
                    status: 'active'
                }, { transaction: t });

                // Create options
                if (v.options && v.options.length > 0) {
                    for (const o of v.options) {
                        const option = await VariationOption.create({
                            variationId: variation.id,
                            name: o.name,
                            status: 'active'
                        }, { transaction: t });

                        if (o.prices && o.prices.length > 0) {
                            for (const p of o.prices) {
                                await VariationPrice.create({
                                    variationOptionId: option.id,
                                    branchId: p.branchId,
                                    price: p.price,
                                    discountPrice: p.discountPrice,
                                    quantity: p.quantity || 0,
                                    expireDate: p.expireDate || null,
                                    batchNo: p.batchNo || null
                                }, { transaction: t });
                            }
                        }
                    }
                }

                // Create modifications associated with this variation
                if (v.modifications && v.modifications.length > 0) {
                    for (const m of v.modifications) {
                        await ProductModification.create({
                            productId: product.id,
                            variationId: variation.id,
                            modificationId: m.modificationId
                        }, { transaction: t });
                    }
                }
            }
        }

        // 3. Create modifications for product level if any (without variations)
        if (modifications && modifications.length > 0) {
            for (const m of modifications) {
                await ProductModification.create({
                    productId: product.id,
                    modificationId: m.modificationId
                }, { transaction: t });
            }
        }

        await t.commit();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Product Created',
            description: `Product ${name} (${code}) created`,
            metadata: { productId: product.id, name, code, sku }
        });

        res.status(201).json(product);
    } catch (error) {
        await t.rollback();
        if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                message: error.message,
                details: error.errors.map(e => e.message)
            });
        }
        res.status(400).json({ message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const productData = req.body;
        let imageUrl = productData.image;

        if (req.file) {
            const blob = await put(`products/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN
            });
            imageUrl = blob.url;
        }

        let {
            name, code, shortDescription, description, sku, categoryId, subCategoryId,
            variations, modifications, branches
        } = productData;

        // Parse JSON strings if they come from multipart/form-data
        if (typeof branches === 'string') branches = JSON.parse(branches);
        if (typeof variations === 'string') variations = JSON.parse(variations);
        if (typeof modifications === 'string') modifications = JSON.parse(modifications);

        // 1. Update base product
        await Product.update({
            name, code, image: imageUrl, shortDescription, description, sku, categoryId, subCategoryId
        }, { where: { id }, transaction: t });

        // 1.5. Sync Branches
        if (branches) {
            await ProductBranch.destroy({ where: { productId: id }, transaction: t });
            for (const branchId of branches) {
                await ProductBranch.create({
                    productId: id,
                    branchId
                }, { transaction: t });
            }
        }

        // 2. Sync Variations
        if (variations) {
            const oldVariations = await Variation.findAll({ where: { productId: id } });
            for (const v of oldVariations) {
                const oldOptions = await VariationOption.findAll({ where: { variationId: v.id } });
                for (const o of oldOptions) {
                    await VariationPrice.destroy({ where: { variationOptionId: o.id }, transaction: t });
                }
                await VariationOption.destroy({ where: { variationId: v.id }, transaction: t });
            }

            // Explicitly delete variation modifications first before deleting variations to be safe
            await ProductModification.destroy({ where: { productId: id, variationId: { [Op.not]: null } }, transaction: t });
            await Variation.destroy({ where: { productId: id }, transaction: t });

            for (const v of variations) {
                const variation = await Variation.create({
                    productId: id,
                    name: v.name,
                    status: 'active'
                }, { transaction: t });

                if (v.options && v.options.length > 0) {
                    for (const o of v.options) {
                        const option = await VariationOption.create({
                            variationId: variation.id,
                            name: o.name,
                            status: 'active'
                        }, { transaction: t });

                        if (o.prices && o.prices.length > 0) {
                            for (const p of o.prices) {
                                await VariationPrice.create({
                                    variationOptionId: option.id,
                                    branchId: p.branchId,
                                    price: p.price,
                                    discountPrice: p.discountPrice,
                                    quantity: p.quantity || 0,
                                    expireDate: p.expireDate || null,
                                    batchNo: p.batchNo || null
                                }, { transaction: t });
                            }
                        }
                    }
                }

                if (v.modifications && v.modifications.length > 0) {
                    for (const m of v.modifications) {
                        await ProductModification.create({
                            productId: id,
                            variationId: variation.id,
                            modificationId: m.modificationId
                        }, { transaction: t });
                    }
                }
            }
        }

        // 3. Sync Modifications (Product level)
        if (modifications) {
            await ProductModification.destroy({ where: { productId: id, variationId: null }, transaction: t });

            for (const m of modifications) {
                await ProductModification.create({
                    productId: id,
                    modificationId: m.modificationId
                }, { transaction: t });
            }
        }

        await t.commit();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Product Updated',
            description: `Product ID ${id} updated`,
            metadata: { productId: id, updatedFields: productData }
        });

        res.json({ message: 'Product and nested items updated successfully' });
    } catch (error) {
        await t.rollback();
        if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                message: error.message,
                details: error.errors.map(e => e.message)
            });
        }
        res.status(400).json({ message: error.message });
    }
};

exports.getProductsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { status } = req.query;

        let statusFilter = { status: 'active' };
        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const products = await Product.findAll({
            where: {
                categoryId,
                ...statusFilter
            },
            include: [
                { model: Category, as: 'category' },
                { model: Category, as: 'subCategory', required: false },
                { model: ProductBranch, as: 'branches', required: false },
                {
                    model: Variation,
                    as: 'variations',
                    where: statusFilter,
                    required: false,
                    include: [
                        {
                            model: VariationOption,
                            as: 'options',
                            where: statusFilter,
                            required: false,
                            include: [
                                { model: VariationPrice, as: 'prices' },
                                {
                                    model: DiscountItem,
                                    as: 'discountItems',
                                    required: false,
                                    include: [
                                        { model: Discount, required: true, where: { status: 'active' } },
                                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                                    ]
                                }
                            ]
                        },
                        {
                            model: ProductModification,
                            as: 'variationModifications',
                            include: [
                                { model: Modification, where: statusFilter, required: false }
                            ]
                        }
                    ]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification, where: statusFilter, required: false }
                    ]
                },
                {
                    model: DiscountItem,
                    as: 'discountItems',
                    required: false,
                    include: [
                        { model: Discount, required: true, where: { status: 'active' } },
                        { model: Branch, as: 'branch', attributes: ['id', 'name'], required: false }
                    ]
                }
            ]
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deactivateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Product.update({ status: 'inactive' }, { where: { id } });

        if (updated) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Product Deactivated',
                description: `Product ID ${id} deactivated`,
                metadata: { productId: id }
            });
            return res.json({ message: 'Product deactivated successfully' });
        }

        res.status(404).json({ message: 'Product not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.activateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Product.update({ status: 'active' }, { where: { id } });

        if (updated) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Product Activated',
                description: `Product ID ${id} activated`,
                metadata: { productId: id }
            });
            return res.json({ message: 'Product activated successfully' });
        }

        res.status(404).json({ message: 'Product not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
