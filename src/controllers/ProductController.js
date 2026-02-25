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
const sequelize = require('../config/database');
const { put } = require('@vercel/blob');

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
                { model: Category, where: statusFilter, required: false },
                {
                    model: Variation,
                    as: 'variations',
                    where: statusFilter,
                    required: false,
                    include: [
                        { model: VariationPrice, as: 'prices' },
                        {
                            model: ProductModification,
                            as: 'variationModifications',
                            include: [
                                { model: Modification, where: statusFilter, required: false },
                                {
                                    model: ProductModificationItemPrice,
                                    as: 'itemPrices',
                                    include: [{ model: ModificationItem, as: 'item' }]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification, where: statusFilter, required: false },
                        {
                            model: ProductModificationItemPrice,
                            as: 'itemPrices',
                            include: [{ model: ModificationItem, as: 'item' }]
                        }
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
        const { categoryId, status } = req.query;

        let statusFilter = { status: 'active' };
        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const where = { ...statusFilter };
        if (categoryId) where.categoryId = categoryId;

        const products = await Product.findAll({
            where,
            include: [
                { model: Category, where: statusFilter, required: false },
                {
                    model: Variation,
                    as: 'variations',
                    where: statusFilter,
                    required: false,
                    include: [
                        { model: VariationPrice, as: 'prices' },
                        {
                            model: ProductModification,
                            as: 'variationModifications',
                            include: [
                                { model: Modification, where: statusFilter, required: false },
                                {
                                    model: ProductModificationItemPrice,
                                    as: 'itemPrices',
                                    include: [{ model: ModificationItem, as: 'item' }]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification, where: statusFilter, required: false },
                        {
                            model: ProductModificationItemPrice,
                            as: 'itemPrices',
                            include: [{ model: ModificationItem, as: 'item' }]
                        }
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
                {
                    model: Category,
                    required: false
                },
                {
                    model: Variation,
                    as: 'variations',
                    required: false,
                    include: [
                        { model: VariationPrice, as: 'prices' },
                        {
                            model: ProductModification,
                            as: 'variationModifications',
                            include: [
                                { model: Modification, required: false },
                                {
                                    model: ProductModificationItemPrice,
                                    as: 'itemPrices',
                                    include: [{ model: ModificationItem, as: 'item' }]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification, required: false },
                        {
                            model: ProductModificationItemPrice,
                            as: 'itemPrices',
                            include: [{ model: ModificationItem, as: 'item' }]
                        }
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

        const {
            name, code, shortDescription, description, sku, expireDate, categoryId,
            variations, modifications
        } = productData;

        // 1. Create base product
        const product = await Product.create({
            name, code, image: imageUrl, shortDescription, description, sku, expireDate, categoryId, status: 'active'
        }, { transaction: t });

        // 2. Create variations and their prices
        if (variations && variations.length > 0) {
            for (const v of variations) {
                const variation = await Variation.create({
                    productId: product.id,
                    name: v.name,
                    status: 'active'
                }, { transaction: t });

                if (v.prices && v.prices.length > 0) {
                    for (const p of v.prices) {
                        await VariationPrice.create({
                            variationId: variation.id,
                            branchId: p.branchId,
                            price: p.price,
                            discountPrice: p.discountPrice,
                            stockQuantity: p.stockQuantity || 0
                        }, { transaction: t });
                    }
                }

                if (v.modifications && v.modifications.length > 0) {
                    for (const m of v.modifications) {
                        const variationMod = await ProductModification.create({
                            variationId: variation.id,
                            modificationId: m.modificationId
                        }, { transaction: t });

                        if (m.itemPrices && m.itemPrices.length > 0) {
                            for (const ip of m.itemPrices) {
                                await ProductModificationItemPrice.create({
                                    productModificationId: variationMod.id,
                                    modificationItemId: ip.modificationItemId,
                                    branchId: ip.branchId,
                                    price: ip.price
                                }, { transaction: t });
                            }
                        }
                    }
                }
            }
        }

        // 3. Create modifications for product level if any
        if (modifications && modifications.length > 0) {
            for (const m of modifications) {
                const productMod = await ProductModification.create({
                    productId: product.id,
                    modificationId: m.modificationId
                }, { transaction: t });

                if (m.itemPrices && m.itemPrices.length > 0) {
                    for (const ip of m.itemPrices) {
                        await ProductModificationItemPrice.create({
                            productModificationId: productMod.id,
                            modificationItemId: ip.modificationItemId,
                            branchId: ip.branchId,
                            price: ip.price
                        }, { transaction: t });
                    }
                }
            }
        }

        await t.commit();
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

        const {
            name, code, shortDescription, description, sku, expireDate, categoryId,
            variations, modifications
        } = productData;

        // 1. Update base product
        await Product.update({
            name, code, image: imageUrl, shortDescription, description, sku, expireDate, categoryId
        }, { where: { id }, transaction: t });

        // 2. Sync Variations
        if (variations) {
            const oldVariations = await Variation.findAll({ where: { productId: id } });
            for (const v of oldVariations) {
                await VariationPrice.destroy({ where: { variationId: v.id }, transaction: t });
            }
            await Variation.destroy({ where: { productId: id }, transaction: t });

            for (const v of variations) {
                const variation = await Variation.create({
                    productId: id,
                    name: v.name,
                    status: 'active'
                }, { transaction: t });

                if (v.prices && v.prices.length > 0) {
                    for (const p of v.prices) {
                        await VariationPrice.create({
                            variationId: variation.id,
                            branchId: p.branchId,
                            price: p.price,
                            discountPrice: p.discountPrice,
                            stockQuantity: p.stockQuantity || 0
                        }, { transaction: t });
                    }
                }

                if (v.modifications && v.modifications.length > 0) {
                    for (const m of v.modifications) {
                        const variationMod = await ProductModification.create({
                            variationId: variation.id,
                            modificationId: m.modificationId
                        }, { transaction: t });

                        if (m.itemPrices && m.itemPrices.length > 0) {
                            for (const ip of m.itemPrices) {
                                await ProductModificationItemPrice.create({
                                    productModificationId: variationMod.id,
                                    modificationItemId: ip.modificationItemId,
                                    branchId: ip.branchId,
                                    price: ip.price
                                }, { transaction: t });
                            }
                        }
                    }
                }
            }
        }

        // 3. Sync Modifications (Product level)
        if (modifications) {
            const oldProductMods = await ProductModification.findAll({ where: { productId: id, variationId: null } });
            for (const pm of oldProductMods) {
                await ProductModificationItemPrice.destroy({ where: { productModificationId: pm.id }, transaction: t });
            }
            await ProductModification.destroy({ where: { productId: id, variationId: null }, transaction: t });

            for (const m of modifications) {
                const productMod = await ProductModification.create({
                    productId: id,
                    modificationId: m.modificationId
                }, { transaction: t });

                if (m.itemPrices && m.itemPrices.length > 0) {
                    for (const ip of m.itemPrices) {
                        await ProductModificationItemPrice.create({
                            productModificationId: productMod.id,
                            modificationItemId: ip.modificationItemId,
                            branchId: ip.branchId,
                            price: ip.price
                        }, { transaction: t });
                    }
                }
            }
        }

        await t.commit();
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
                {
                    model: Variation,
                    as: 'variations',
                    where: statusFilter,
                    required: false,
                    include: [
                        { model: VariationPrice, as: 'prices' },
                        {
                            model: ProductModification,
                            as: 'variationModifications',
                            include: [
                                { model: Modification, where: statusFilter, required: false },
                                {
                                    model: ProductModificationItemPrice,
                                    as: 'itemPrices',
                                    include: [{ model: ModificationItem, as: 'item' }]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification, where: statusFilter, required: false },
                        {
                            model: ProductModificationItemPrice,
                            as: 'itemPrices',
                            include: [{ model: ModificationItem, as: 'item' }]
                        }
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
            return res.json({ message: 'Product activated successfully' });
        }

        res.status(404).json({ message: 'Product not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
