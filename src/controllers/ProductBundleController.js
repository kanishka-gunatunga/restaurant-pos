const ProductBundle = require('../models/ProductBundle');
const ProductBundleBranch = require('../models/ProductBundleBranch');
const ProductBundleItem = require('../models/ProductBundleItem');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const VariationOption = require('../models/VariationOption');
const VariationPrice = require('../models/VariationPrice');
const sequelize = require('../config/database');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');
const { put } = require('@vercel/blob');


exports.createBundle = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        let bundleData = req.body;
        if (typeof req.body.data === 'string') {
            bundleData = JSON.parse(req.body.data);
        }

        let { name, description, expire_date, branches, items } = bundleData;
        let imageUrl = null;

        if (req.file) {
            const blob = await put(`product_bundles/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN
            });
            imageUrl = blob.url;
        }

        // Parse JSON strings if they come from multipart/form-data
        if (typeof branches === 'string') branches = JSON.parse(branches);
        if (typeof items === 'string') items = JSON.parse(items);

        const bundle = await ProductBundle.create({
            name,
            description,
            expire_date,
            image: imageUrl
        }, { transaction });

        if (branches && branches.length > 0) {
            const branchRecords = branches.map(b => {
                const branchId = b.branchId || b;
                const isObject = typeof b === 'object' && b !== null;
                return {
                    productBundleId: bundle.id,
                    branchId: branchId,
                    original_price: isObject ? b.original_price : null,
                    price: isObject ? b.price : null,
                    customer_saves: isObject ? b.customer_saves : null
                };
            });
            await ProductBundleBranch.bulkCreate(branchRecords, { transaction });
        }

        if (items && items.length > 0) {
            const itemRecords = items.map(i => ({
                productBundleId: bundle.id,
                productId: i.productId,
                variationOptionId: i.variationOptionId,
                quantity: i.quantity || 1
            }));
            await ProductBundleItem.bulkCreate(itemRecords, { transaction });
        }

        await transaction.commit();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Product Bundle Created',
            description: `Product Bundle ${name} created`,
            metadata: { productBundleId: bundle.id, name, branches, items }
        });

        const createdBundle = await ProductBundle.findByPk(bundle.id, {
            include: [
                { model: ProductBundleBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] },
                { 
                    model: ProductBundleItem, 
                    as: 'items', 
                    include: [
                        { model: Product, as: 'product' },
                        { model: VariationOption, as: 'variationOption' }
                    ] 
                }
            ]
        });

        res.status(201).json(createdBundle);
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        res.status(400).json({ message: error.message });
    }
};

exports.getAllBundles = async (req, res) => {
    try {
        const { status } = req.query;
        let where = { status: 'active' };

        if (status === 'inactive') {
            where = { status: 'inactive' };
        } else if (status === 'all') {
            where = {};
        }

        const bundles = await ProductBundle.findAll({
            where,
            include: [
                { model: ProductBundleBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] },
                { 
                    model: ProductBundleItem, 
                    as: 'items', 
                    include: [
                        { model: Product, as: 'product' },
                        { model: VariationOption, as: 'variationOption' }
                    ] 
                }
            ],
            order: [['name', 'ASC']]
        });
        res.json(bundles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getBundleById = async (req, res) => {
    try {
        const { id } = req.params;
        const bundle = await ProductBundle.findByPk(id, {
            include: [
                { model: ProductBundleBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] },
                { 
                    model: ProductBundleItem, 
                    as: 'items', 
                    include: [
                        { model: Product, as: 'product' },
                        { model: VariationOption, as: 'variationOption' }
                    ] 
                }
            ]
        });
        if (!bundle) {
            return res.status(404).json({ message: 'Product Bundle not found' });
        }
        res.json(bundle);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateBundle = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        let bundleData = req.body;
        if (typeof req.body.data === 'string') {
            bundleData = JSON.parse(req.body.data);
        }

        let { name, description, expire_date, branches, items, image } = bundleData;
        let imageUrl = image;

        if (req.file) {
            const blob = await put(`product_bundles/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN
            });
            imageUrl = blob.url;
        }

        // Parse JSON strings if they come from multipart/form-data
        if (typeof branches === 'string') branches = JSON.parse(branches);
        if (typeof items === 'string') items = JSON.parse(items);

        const bundle = await ProductBundle.findByPk(id);
        if (!bundle) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Product Bundle not found' });
        }

        await bundle.update({
            name,
            description,
            expire_date,
            image: imageUrl
        }, { transaction });

        if (branches !== undefined) {
            await ProductBundleBranch.destroy({ where: { productBundleId: id }, transaction });
            if (branches && branches.length > 0) {
                const branchRecords = branches.map(b => {
                    const branchId = b.branchId || b;
                    const isObject = typeof b === 'object' && b !== null;
                    return {
                        productBundleId: id,
                        branchId: branchId,
                        original_price: isObject ? b.original_price : null,
                        price: isObject ? b.price : null,
                        customer_saves: isObject ? b.customer_saves : null
                    };
                });
                await ProductBundleBranch.bulkCreate(branchRecords, { transaction });
            }
        }

        if (items !== undefined) {
            await ProductBundleItem.destroy({ where: { productBundleId: id }, transaction });
            if (items && items.length > 0) {
                const itemRecords = items.map(i => ({
                    productBundleId: id,
                    productId: i.productId,
                    variationOptionId: i.variationOptionId,
                    quantity: i.quantity || 1
                }));
                await ProductBundleItem.bulkCreate(itemRecords, { transaction });
            }
        }

        await transaction.commit();

        const updatedBundle = await ProductBundle.findByPk(id, {
            include: [
                { model: ProductBundleBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] },
                { 
                    model: ProductBundleItem, 
                    as: 'items', 
                    include: [
                        { model: Product, as: 'product' },
                        { model: VariationOption, as: 'variationOption' }
                    ] 
                }
            ]
        });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Product Bundle Updated',
            description: `Product Bundle ${updatedBundle.name} updated`,
            metadata: { productBundleId: id, name, branches, items }
        });

        res.json(updatedBundle);
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        res.status(400).json({ message: error.message });
    }
};

exports.deactivateBundle = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await ProductBundle.update({ status: 'inactive' }, { where: { id } });
        if (updated) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Product Bundle Deactivated',
                description: `Product Bundle ID ${id} deactivated`,
                metadata: { productBundleId: id }
            });
            return res.json({ message: 'Product Bundle deactivated' });
        }
        throw new Error('Product Bundle not found');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.activateBundle = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await ProductBundle.update({ status: 'active' }, { where: { id } });
        if (updated) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Product Bundle Activated',
                description: `Product Bundle ID ${id} activated`,
                metadata: { productBundleId: id }
            });
            return res.json({ message: 'Product Bundle activated' });
        }
        throw new Error('Product Bundle not found');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getBundlesByBranch = async (req, res) => {
    try {
        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        const branchId = userDetail?.branchId || 1;

        const bundles = await ProductBundle.findAll({
            where: { status: 'active' },
            include: [
                {
                    model: ProductBundleBranch,
                    as: 'branches',
                    where: { branchId },
                    required: true,
                    include: [{ model: Branch, as: 'branch' }]
                },
                {
                    model: ProductBundleItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        {
                            model: VariationOption,
                            as: 'variationOption',
                            include: [
                                {
                                    model: VariationPrice,
                                    as: 'prices',
                                    where: { branchId },
                                    required: false // Include even if price is not set for this specific branch
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [['name', 'ASC']]
        });

        res.json(bundles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
