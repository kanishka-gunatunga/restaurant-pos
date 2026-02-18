const Product = require('../models/Product');
const Category = require('../models/Category');
const Variation = require('../models/Variation');
const VariationPrice = require('../models/VariationPrice');
const Modification = require('../models/Modification');
const ProductModification = require('../models/ProductModification');
const ProductModificationPrice = require('../models/ProductModificationPrice');
const sequelize = require('../config/database');
const { put } = require('@vercel/blob');

exports.getAllProducts = async (req, res) => {
    try {
        const { categoryId } = req.query;
        const where = categoryId ? { categoryId } : {};
        const products = await Product.findAll({
            where,
            include: [
                { model: Category },
                {
                    model: Variation,
                    as: 'variations',
                    include: [{ model: VariationPrice, as: 'prices' }]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification },
                        { model: ProductModificationPrice, as: 'prices' }
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
                { model: Category },
                {
                    model: Variation,
                    as: 'variations',
                    include: [{ model: VariationPrice, as: 'prices' }]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification },
                        { model: ProductModificationPrice, as: 'prices' }
                    ]
                }
            ]
        });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createProduct = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        let productData = req.body;
        if (req.body.data) {
            productData = JSON.parse(req.body.data);
        }

        let imageUrl = productData.image;
        if (req.file) {
            const blob = await put(`products/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            imageUrl = blob.url;
        }

        const {
            name, code, shortDescription, description, sku, categoryId,
            variations, modifications
        } = productData;

        const product = await Product.create({
            name, code, image: imageUrl, shortDescription, description, sku, categoryId
        }, { transaction: t });

        // Handle Variations
        if (variations && variations.length > 0) {
            for (const v of variations) {
                const variation = await Variation.create({
                    productId: product.id,
                    name: v.name
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
            }
        }

        // Handle Modifications
        if (modifications && modifications.length > 0) {
            for (const m of modifications) {
                const productMod = await ProductModification.create({
                    productId: product.id,
                    modificationId: m.modificationId
                }, { transaction: t });

                if (m.prices && m.prices.length > 0) {
                    for (const mp of m.prices) {
                        await ProductModificationPrice.create({
                            productModificationId: productMod.id,
                            branchId: mp.branchId,
                            price: mp.price
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
        let productData = req.body;
        if (req.body.data) {
            productData = JSON.parse(req.body.data);
        }

        let imageUrl = productData.image;
        if (req.file) {
            const blob = await put(`products/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            imageUrl = blob.url;
        }

        const {
            name, shortDescription, description, sku, categoryId,
            variations, modifications
        } = productData;

        // 1. Update base product
        await Product.update({
            name, code, image: imageUrl, shortDescription, description, sku, categoryId
        }, { where: { id }, transaction: t });

        // 2. Sync Variations
        if (variations) {
            // Delete existing variation prices first (cascading cleanup)
            const oldVariations = await Variation.findAll({ where: { productId: id } });
            for (const v of oldVariations) {
                await VariationPrice.destroy({ where: { variationId: v.id }, transaction: t });
            }
            await Variation.destroy({ where: { productId: id }, transaction: t });

            // Re-create new variations and prices
            for (const v of variations) {
                const variation = await Variation.create({
                    productId: id,
                    name: v.name
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
            }
        }

        // 3. Sync Modifications
        if (modifications) {
            // Delete existing product-modification prices and associations
            const oldProductMods = await ProductModification.findAll({ where: { productId: id } });
            for (const pm of oldProductMods) {
                await ProductModificationPrice.destroy({ where: { productModificationId: pm.id }, transaction: t });
            }
            await ProductModification.destroy({ where: { productId: id }, transaction: t });

            // Re-create new modification associations and prices
            for (const m of modifications) {
                const productMod = await ProductModification.create({
                    productId: id,
                    modificationId: m.modificationId
                }, { transaction: t });

                if (m.prices && m.prices.length > 0) {
                    for (const mp of m.prices) {
                        await ProductModificationPrice.create({
                            productModificationId: productMod.id,
                            branchId: mp.branchId,
                            price: mp.price
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
        const products = await Product.findAll({
            where: { categoryId },
            include: [
                { model: Category },
                {
                    model: Variation,
                    as: 'variations',
                    include: [{ model: VariationPrice, as: 'prices' }]
                },
                {
                    model: ProductModification,
                    as: 'productModifications',
                    include: [
                        { model: Modification },
                        { model: ProductModificationPrice, as: 'prices' }
                    ]
                }
            ]
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const deleted = await Product.destroy({ where: { id }, transaction: t });

        if (deleted) {
            await t.commit();
            return res.json({ message: 'Product and all related details deleted successfully' });
        }

        await t.rollback();
        res.status(404).json({ message: 'Product not found' });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: error.message });
    }
};
