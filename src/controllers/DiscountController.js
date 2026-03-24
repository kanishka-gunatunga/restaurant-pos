const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Discount = require('../models/Discount');
const DiscountItem = require('../models/DiscountItem');
const DiscountBranch = require('../models/DiscountBranch');
const Product = require('../models/Product');
const VariationOption = require('../models/VariationOption');
const Variation = require('../models/Variation');
const VariationPrice = require('../models/VariationPrice');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');

const DISCOUNT_INCLUDE = [
    {
        model: DiscountBranch,
        as: 'branches',
        attributes: ['branchId'],
    },
    {
        model: DiscountItem,
        as: 'items',
        include: [
            {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'code', 'image'],
                required: false,
            },
            {
                model: VariationOption,
                as: 'variationOption',
                attributes: ['id', 'name'],
                required: false,
                include: [
                    {
                        model: Variation,
                        attributes: ['id', 'name'],
                        include: [
                            {
                                model: Product,
                                attributes: ['id', 'name', 'code', 'image'],
                            },
                        ],
                    },
                    {
                        model: VariationPrice,
                        as: 'prices',
                        required: false,
                    },
                ],
            },
        ],
    },
];

exports.createDiscount = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { name, expiryDate, isForAllBranches = true, branches, items } = req.body;

        if (!name) {
            await t.rollback();
            return res.status(400).json({ message: 'Discount name is required' });
        }

        if (!items || items.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: 'At least one discount item is required' });
        }

        // Validate items
        for (const item of items) {
            if (!item.productId && !item.variationOptionId) {
                await t.rollback();
                return res.status(400).json({ message: 'Each discount item must have either a productId or a variationOptionId' });
            }
            if (!item.discountType || !['percentage', 'fixed'].includes(item.discountType)) {
                await t.rollback();
                return res.status(400).json({ message: 'discountType must be either "percentage" or "fixed"' });
            }
            if (isForAllBranches) {
                if (item.discountValue === undefined || item.discountValue === null || Number(item.discountValue) < 0) {
                    await t.rollback();
                    return res.status(400).json({ message: 'discountValue must be a non-negative number' });
                }
            } else {
                if (!item.branchDiscounts || item.branchDiscounts.length === 0) {
                    await t.rollback();
                    return res.status(400).json({ message: 'branchDiscounts array is required when isForAllBranches is false' });
                }
                for (const bd of item.branchDiscounts) {
                    if (bd.discountValue === undefined || bd.discountValue === null || Number(bd.discountValue) < 0) {
                        await t.rollback();
                        return res.status(400).json({ message: 'discountValue in branchDiscounts must be a non-negative number' });
                    }
                }
            }
        }

        // Create discount
        const discount = await Discount.create(
            { name, expiryDate: expiryDate || null, isForAllBranches, status: 'active' },
            { transaction: t }
        );

        if (!isForAllBranches && branches && branches.length > 0) {
            for (const branchId of branches) {
                await DiscountBranch.create({ discountId: discount.id, branchId }, { transaction: t });
            }
        }

        // Create discount items
        for (const item of items) {
            if (isForAllBranches) {
                await DiscountItem.create(
                    {
                        discountId: discount.id,
                        productId: item.productId || null,
                        variationOptionId: item.variationOptionId || null,
                        branchId: null,
                        discountType: item.discountType,
                        discountValue: item.discountValue,
                    },
                    { transaction: t }
                );
            } else {
                for (const bd of item.branchDiscounts) {
                    await DiscountItem.create(
                        {
                            discountId: discount.id,
                            productId: item.productId || null,
                            variationOptionId: item.variationOptionId || null,
                            branchId: bd.branchId,
                            discountType: item.discountType,
                            discountValue: bd.discountValue,
                        },
                        { transaction: t }
                    );
                }
            }
        }

        await t.commit();

        // Return with associations
        const created = await Discount.findByPk(discount.id, { include: DISCOUNT_INCLUDE });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Discount Created',
            description: `Discount ${name} created`,
            metadata: { discountId: discount.id, name, expiryDate }
        });

        return res.status(201).json(created);
    } catch (error) {
        await t.rollback();
        return res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/discounts
 * Query: status (active|inactive|all), search (name)
 */
exports.getAllDiscounts = async (req, res) => {
    try {
        const { status, search } = req.query;

        const where = {};
        if (status === 'inactive') {
            where.status = 'inactive';
        } else if (status !== 'all') {
            where.status = 'active';
        }

        if (search) {
            where.name = { [Op.like]: `%${search}%` };
        }

        const discounts = await Discount.findAll({ where, include: DISCOUNT_INCLUDE, order: [['createdAt', 'DESC']] });
        return res.json(discounts);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/discounts/:id
 */
exports.getDiscountById = async (req, res) => {
    try {
        const { id } = req.params;
        const discount = await Discount.findByPk(id, { include: DISCOUNT_INCLUDE });

        if (!discount) {
            return res.status(404).json({ message: 'Discount not found' });
        }

        return res.json(discount);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * PUT /api/discounts/:id
 * Body: { name?, expiryDate?, items? }
 * If items is provided, the existing items are replaced.
 */
exports.updateDiscount = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { name, expiryDate, isForAllBranches, branches, items } = req.body;

        const discount = await Discount.findByPk(id);
        if (!discount) {
            await t.rollback();
            return res.status(404).json({ message: 'Discount not found' });
        }

        const currentIsForAllBranches = isForAllBranches !== undefined ? isForAllBranches : discount.isForAllBranches;

        // Update header fields
        await discount.update(
            {
                name: name !== undefined ? name : discount.name,
                expiryDate: expiryDate !== undefined ? (expiryDate || null) : discount.expiryDate,
                isForAllBranches: currentIsForAllBranches,
            },
            { transaction: t }
        );

        if (currentIsForAllBranches === false && branches !== undefined) {
            await DiscountBranch.destroy({ where: { discountId: id }, transaction: t });
            for (const branchId of branches) {
                await DiscountBranch.create({ discountId: id, branchId }, { transaction: t });
            }
        } else if (currentIsForAllBranches === true) {
            await DiscountBranch.destroy({ where: { discountId: id }, transaction: t });
        }

        // Sync items if provided
        if (items !== undefined) {
            if (items.length === 0) {
                await t.rollback();
                return res.status(400).json({ message: 'At least one discount item is required' });
            }

            for (const item of items) {
                if (!item.productId && !item.variationOptionId) {
                    await t.rollback();
                    return res.status(400).json({ message: 'Each discount item must have either a productId or a variationOptionId' });
                }
                if (!item.discountType || !['percentage', 'fixed'].includes(item.discountType)) {
                    await t.rollback();
                    return res.status(400).json({ message: 'discountType must be either "percentage" or "fixed"' });
                }
                if (currentIsForAllBranches) {
                    if (item.discountValue === undefined || item.discountValue === null || Number(item.discountValue) < 0) {
                        await t.rollback();
                        return res.status(400).json({ message: 'discountValue must be a non-negative number' });
                    }
                } else {
                    if (!item.branchDiscounts || item.branchDiscounts.length === 0) {
                        await t.rollback();
                        return res.status(400).json({ message: 'branchDiscounts array is required when isForAllBranches is false' });
                    }
                    for (const bd of item.branchDiscounts) {
                        if (bd.discountValue === undefined || bd.discountValue === null || Number(bd.discountValue) < 0) {
                            await t.rollback();
                            return res.status(400).json({ message: 'discountValue in branchDiscounts must be a non-negative number' });
                        }
                    }
                }
            }

            // Delete existing items and recreate
            await DiscountItem.destroy({ where: { discountId: id }, transaction: t });

            for (const item of items) {
                if (currentIsForAllBranches) {
                    await DiscountItem.create(
                        {
                            discountId: id,
                            productId: item.productId || null,
                            variationOptionId: item.variationOptionId || null,
                            branchId: null,
                            discountType: item.discountType,
                            discountValue: item.discountValue,
                        },
                        { transaction: t }
                    );
                } else {
                    for (const bd of item.branchDiscounts) {
                        await DiscountItem.create(
                            {
                                discountId: id,
                                productId: item.productId || null,
                                variationOptionId: item.variationOptionId || null,
                                branchId: bd.branchId,
                                discountType: item.discountType,
                                discountValue: bd.discountValue,
                            },
                            { transaction: t }
                        );
                    }
                }
            }
        }

        await t.commit();

        const updated = await Discount.findByPk(id, { include: DISCOUNT_INCLUDE });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Discount Updated',
            description: `Discount ${updated.name} updated`,
            metadata: { discountId: id, name, expiryDate }
        });

        return res.json(updated);
    } catch (error) {
        await t.rollback();
        return res.status(500).json({ message: error.message });
    }
};

/**
 * DELETE /api/discounts/:id
 */
exports.deleteDiscount = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const discount = await Discount.findByPk(id);

        if (!discount) {
            await t.rollback();
            return res.status(404).json({ message: 'Discount not found' });
        }

        await DiscountBranch.destroy({ where: { discountId: id }, transaction: t });
        await DiscountItem.destroy({ where: { discountId: id }, transaction: t });
        await discount.destroy({ transaction: t });

        await t.commit();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Discount Deleted',
            description: `Discount ${discount.name} deleted`,
            metadata: { discountId: id, name: discount.name }
        });

        return res.json({ message: 'Discount deleted successfully' });
    } catch (error) {
        await t.rollback();
        return res.status(500).json({ message: error.message });
    }
};

/**
 * POST /api/discounts/:id/activate
 */
exports.activateDiscount = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Discount.update({ status: 'active' }, { where: { id } });

        if (!updated) {
            return res.status(404).json({ message: 'Discount not found' });
        }

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Discount Activated',
            description: `Discount ID ${id} activated`,
            metadata: { discountId: id }
        });

        return res.json({ message: 'Discount activated successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * POST /api/discounts/:id/deactivate
 */
exports.deactivateDiscount = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Discount.update({ status: 'inactive' }, { where: { id } });

        if (!updated) {
            return res.status(404).json({ message: 'Discount not found' });
        }

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Discount Deactivated',
            description: `Discount ID ${id} deactivated`,
            metadata: { discountId: id }
        });

        return res.json({ message: 'Discount deactivated successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
