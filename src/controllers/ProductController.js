const Product = require('../models/Product');
const Category = require('../models/Category');
const Variation = require('../models/Variation');
const VariationPrice = require('../models/VariationPrice');
const Modification = require('../models/Modification');
const ProductModification = require('../models/ProductModification');
const ProductModificationPrice = require('../models/ProductModificationPrice');
const sequelize = require('../config/database');

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
                    model: Modification,
                    as: 'modifications',
                    through: { attributes: [] }, // Hide join table attributes
                    include: [
                        {
                            model: ProductModification,
                            include: [{ model: ProductModificationPrice, as: 'prices' }]
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
                { model: Category },
                {
                    model: Variation,
                    as: 'variations',
                    include: [{ model: VariationPrice, as: 'prices' }]
                },
                {
                    model: Modification,
                    as: 'modifications',
                    include: [
                        {
                            model: ProductModification,
                            as: 'ProductModification', // Depending on how Sequelize names it
                            include: [{ model: ProductModificationPrice, as: 'prices' }]
                        }
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
        const {
            name, image, shortDescription, description, sku, categoryId,
            variations, modifications
        } = req.body;

        const product = await Product.create({
            name, image, shortDescription, description, sku, categoryId
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
                            discountPrice: p.discountPrice
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
        res.status(400).json({ message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    // Note: Complex update logic would typically involve syncing variations/modifications.
    // Simplifying to just base product update for now as per usual pattern.
    try {
        const { id } = req.params;
        await Product.update(req.body, { where: { id } });
        res.json({ message: 'Product updated' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        await Product.destroy({ where: { id } });
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
