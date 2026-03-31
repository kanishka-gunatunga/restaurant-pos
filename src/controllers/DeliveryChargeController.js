const DeliveryCharge = require('../models/DeliveryCharge');
const DeliveryChargeBranch = require('../models/DeliveryChargeBranch');
const Branch = require('../models/Branch');
const sequelize = require('../config/database');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');

exports.createDeliveryCharge = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { title, amount, branches } = req.body;

        const deliveryCharge = await DeliveryCharge.create({ title, amount }, { transaction });

        if (branches && branches.length > 0) {
            const branchRecords = branches.map(branchId => ({
                deliveryChargeId: deliveryCharge.id,
                branchId
            }));
            await DeliveryChargeBranch.bulkCreate(branchRecords, { transaction });
        }

        await transaction.commit();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Delivery Charge Created',
            description: `Delivery Charge ${title} created`,
            metadata: { deliveryChargeId: deliveryCharge.id, title, amount, branches }
        });

        const createdCharge = await DeliveryCharge.findByPk(deliveryCharge.id, {
            include: [{ model: DeliveryChargeBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] }]
        });

        res.status(201).json(createdCharge);
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.getAllDeliveryCharges = async (req, res) => {
    try {
        const { status } = req.query;
        let where = { status: 'active' };

        if (status === 'inactive') {
            where = { status: 'inactive' };
        } else if (status === 'all') {
            where = {};
        }

        const deliveryCharges = await DeliveryCharge.findAll({
            where,
            include: [{ model: DeliveryChargeBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] }],
            order: [['title', 'ASC']]
        });
        res.json(deliveryCharges);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getDeliveryChargeById = async (req, res) => {
    try {
        const { id } = req.params;
        const deliveryCharge = await DeliveryCharge.findByPk(id, {
            include: [{ model: DeliveryChargeBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] }]
        });
        if (!deliveryCharge) {
            return res.status(404).json({ message: 'Delivery Charge not found' });
        }
        res.json(deliveryCharge);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getDeliveryChargesByBranch = async (req, res) => {
    try {
        const { branchId } = req.params;
        const deliveryChargeBranches = await DeliveryChargeBranch.findAll({
            where: { branchId },
            include: [{
                model: DeliveryCharge,
                where: { status: 'active' }
            }]
        });

        const deliveryCharges = deliveryChargeBranches.map(dcb => dcb.DeliveryCharge);
        res.json(deliveryCharges);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateDeliveryCharge = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { title, amount, branches } = req.body;

        const deliveryCharge = await DeliveryCharge.findByPk(id);
        if (!deliveryCharge) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Delivery Charge not found' });
        }

        await deliveryCharge.update({ title, amount }, { transaction });

        if (branches !== undefined) {
            await DeliveryChargeBranch.destroy({ where: { deliveryChargeId: id }, transaction });
            if (branches && branches.length > 0) {
                const branchRecords = branches.map(branchId => ({
                    deliveryChargeId: id,
                    branchId
                }));
                await DeliveryChargeBranch.bulkCreate(branchRecords, { transaction });
            }
        }

        await transaction.commit();

        const updatedCharge = await DeliveryCharge.findByPk(id, {
            include: [{ model: DeliveryChargeBranch, as: 'branches', include: [{ model: Branch, as: 'branch' }] }]
        });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Delivery Charge Updated',
            description: `Delivery Charge ${updatedCharge.title} updated`,
            metadata: { deliveryChargeId: id, title, amount, branches }
        });

        res.json(updatedCharge);
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.deactivateDeliveryCharge = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await DeliveryCharge.update({ status: 'inactive' }, { where: { id } });
        if (updated) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Delivery Charge Deactivated',
                description: `Delivery Charge ID ${id} deactivated`,
                metadata: { deliveryChargeId: id }
            });
            return res.json({ message: 'Delivery Charge deactivated' });
        }
        throw new Error('Delivery Charge not found');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.activateDeliveryCharge = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await DeliveryCharge.update({ status: 'active' }, { where: { id } });
        if (updated) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Delivery Charge Activated',
                description: `Delivery Charge ID ${id} activated`,
                metadata: { deliveryChargeId: id }
            });
            return res.json({ message: 'Delivery Charge activated' });
        }
        throw new Error('Delivery Charge not found');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
