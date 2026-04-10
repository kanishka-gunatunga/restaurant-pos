const BogoPromotion = require('../models/BogoPromotion');
const BogoPromotionBranch = require('../models/BogoPromotionBranch');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const sequelize = require('../config/database');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');
const VariationOption = require('../models/VariationOption');

exports.createBogoPromotion = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { name, expiryDate, buyQuantity, getQuantity, buyProductId, getProductId, buyVariationOptionId, getVariationOptionId, branches } = req.body;

        const promotion = await BogoPromotion.create({
            name,
            expiryDate,
            buyQuantity: buyQuantity || 1,
            getQuantity: getQuantity || 1,
            buyProductId,
            getProductId,
            buyVariationOptionId,
            getVariationOptionId,
        }, { transaction });

        if (branches && branches.length > 0) {
            const branchRecords = branches.map(b => ({
                bogoPromotionId: promotion.id,
                branchId: b.branchId || b
            }));
            await BogoPromotionBranch.bulkCreate(branchRecords, { transaction });
        }

        await transaction.commit();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'BOGO Promotion Created',
            description: `BOGO Promotion ${name} created`,
            metadata: { bogoPromotionId: promotion.id, name, branches }
        });

        const createdPromotion = await BogoPromotion.findByPk(promotion.id, {
            include: [
                { model: BogoPromotionBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] },
                { model: Product, as: 'buyProduct' },
                { model: VariationOption, as: 'buyVariationOption' },
                { model: Product, as: 'getProduct' },
                { model: VariationOption, as: 'getVariationOption' }
            ]
        });

        res.status(201).json(createdPromotion);
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.getAllBogoPromotions = async (req, res) => {
    try {
        const { status } = req.query;
        let where = { status: 'active' };

        if (status === 'inactive') {
            where = { status: 'inactive' };
        } else if (status === 'all') {
            where = {};
        }

        const promotions = await BogoPromotion.findAll({
            where,
            include: [
                { model: BogoPromotionBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] },
                { model: Product, as: 'buyProduct' },
                { model: VariationOption, as: 'buyVariationOption' },
                { model: Product, as: 'getProduct' },
                { model: VariationOption, as: 'getVariationOption' }
            ],
            order: [['name', 'ASC']]
        });
        res.json(promotions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getBogoPromotionById = async (req, res) => {
    try {
        const { id } = req.params;
        const promotion = await BogoPromotion.findByPk(id, {
            include: [
                { model: BogoPromotionBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] },
                { model: Product, as: 'buyProduct' },
                { model: VariationOption, as: 'buyVariationOption' },
                { model: Product, as: 'getProduct' },
                { model: VariationOption, as: 'getVariationOption' }
            ]
        });
        if (!promotion) {
            return res.status(404).json({ message: 'BOGO Promotion not found' });
        }
        res.json(promotion);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateBogoPromotion = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { name, expiryDate, buyQuantity, getQuantity, buyProductId, getProductId, buyVariationOptionId, getVariationOptionId, branches, status } = req.body;

        const promotion = await BogoPromotion.findByPk(id);
        if (!promotion) {
            await transaction.rollback();
            return res.status(404).json({ message: 'BOGO Promotion not found' });
        }

        await promotion.update({
            name,
            expiryDate,
            buyQuantity,
            getQuantity,
            buyProductId,
            getProductId,
            buyVariationOptionId,
            getVariationOptionId,
            status
        }, { transaction });

        if (branches !== undefined) {
            await BogoPromotionBranch.destroy({ where: { bogoPromotionId: id }, transaction });
            if (branches && branches.length > 0) {
                const branchRecords = branches.map(b => ({
                    bogoPromotionId: id,
                    branchId: b.branchId || b
                }));
                await BogoPromotionBranch.bulkCreate(branchRecords, { transaction });
            }
        }

        await transaction.commit();

        const updatedPromotion = await BogoPromotion.findByPk(id, {
            include: [
                { model: BogoPromotionBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] },
                { model: Product, as: 'buyProduct' },
                { model: VariationOption, as: 'buyVariationOption' },
                { model: Product, as: 'getProduct' },
                { model: VariationOption, as: 'getVariationOption' }
            ]
        });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'BOGO Promotion Updated',
            description: `BOGO Promotion ${updatedPromotion.name} updated`,
            metadata: { bogoPromotionId: id, name, branches }
        });

        res.json(updatedPromotion);
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.deactivateBogoPromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await BogoPromotion.update({ status: 'inactive' }, { where: { id } });
        if (updated) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'BOGO Promotion Deactivated',
                description: `BOGO Promotion ID ${id} deactivated`,
                metadata: { bogoPromotionId: id }
            });
            return res.json({ message: 'BOGO Promotion deactivated' });
        }
        throw new Error('BOGO Promotion not found');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.activateBogoPromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await BogoPromotion.update({ status: 'active' }, { where: { id } });
        if (updated) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'BOGO Promotion Activated',
                description: `BOGO Promotion ID ${id} activated`,
                metadata: { bogoPromotionId: id }
            });
            return res.json({ message: 'BOGO Promotion activated' });
        }
        throw new Error('BOGO Promotion not found');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
