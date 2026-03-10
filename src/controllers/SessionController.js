const Session = require('../models/Session');
const SessionTransaction = require('../models/SessionTransaction');
const User = require('../models/User');
const UserDetail = require('../models/UserDetail');
const sequelize = require('../config/database');
const { decrypt } = require('../utils/crypto');

const verifyManagerPasscode = async (passcode) => {
    if (!passcode) return false;
    const managers = await User.findAll({
        where: {
            role: ['admin', 'manager'],
            status: 'active'
        }
    });

    for (const manager of managers) {
        if (manager.passcode && passcode === decrypt(manager.passcode)) {
            return {
                id: manager.id,
                role: manager.role
            };
        }
    }
    return false;
};

exports.startSession = async (req, res) => {
    try {
        const userId = req.user.id;
        let { startBalance, branchId, passcode } = req.body;

        if (!passcode) {
            return res.status(400).json({ message: 'Manager passcode is required to start session' });
        }

        const manager = await verifyManagerPasscode(passcode);
        if (!manager) {
            return res.status(401).json({ message: 'Invalid manager passcode' });
        }

        // Automatically fetch branchId from user profile if not provided
        if (!branchId) {
            const userDetail = await UserDetail.findOne({ where: { userId } });
            branchId = userDetail ? userDetail.branchId : 1; // Fallback to 1 if not found
        }

        // Check if user already has an open session
        const activeSession = await Session.findOne({
            where: {
                userId,
                status: 'open'
            }
        });

        if (activeSession) {
            return res.status(400).json({ message: 'You already have an active session open' });
        }

        const session = await Session.create({
            userId,
            branchId,
            startBalance: startBalance || 0,
            currentBalance: startBalance || 0,
            status: 'open',
            startTime: new Date()
        });

        res.status(201).json(session);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getActiveSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const session = await Session.findOne({
            where: {
                userId,
                status: 'open'
            },
            include: [
                {
                    model: SessionTransaction,
                    as: 'transactions',
                    limit: 10,
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        if (!session) {
            return res.status(404).json({ message: 'No active session found' });
        }

        res.json(session);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.cashAction = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const userId = req.user.id;
        const { type, amount, description, passcode } = req.body; // type: 'add' or 'remove'

        if (!passcode) {
            return res.status(400).json({ message: 'Manager passcode is required for cash actions' });
        }

        const manager = await verifyManagerPasscode(passcode);
        if (!manager) {
            return res.status(401).json({ message: 'Invalid manager passcode' });
        }

        if (!['add', 'remove'].includes(type)) {
            return res.status(400).json({ message: 'Invalid action type. Must be add or remove.' });
        }

        const session = await Session.findOne({
            where: {
                userId,
                status: 'open'
            }
        });

        if (!session) {
            return res.status(404).json({ message: 'No active session found' });
        }

        const newBalance = type === 'add'
            ? parseFloat(session.currentBalance) + parseFloat(amount)
            : parseFloat(session.currentBalance) - parseFloat(amount);

        if (newBalance < 0) {
            return res.status(400).json({ message: 'Insufficient balance in drawer' });
        }

        await session.update({ currentBalance: newBalance }, { transaction: t });

        const transaction = await SessionTransaction.create({
            sessionId: session.id,
            type,
            amount,
            description,
            userId
        }, { transaction: t });

        await t.commit();
        res.json({ session, transaction });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: error.message });
    }
};

exports.closeSession = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const userId = req.user.id;
        const { passcode } = req.body;

        if (!passcode) {
            return res.status(400).json({ message: 'Manager passcode is required to close session' });
        }

        const manager = await verifyManagerPasscode(passcode);
        if (!manager) {
            return res.status(401).json({ message: 'Invalid manager passcode' });
        }

        const session = await Session.findOne({
            where: {
                userId,
                status: 'open'
            }
        });

        if (!session) {
            return res.status(404).json({ message: 'No active session found' });
        }

        await session.update({
            status: 'closed',
            endTime: new Date(),
            closedBy: manager.id
        }, { transaction: t });

        await t.commit();
        res.json({ message: 'Session closed successfully', session });
    } catch (error) {
        await t.rollback();
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('initialization vector') || msg.includes('decipher')) {
            return res.status(500).json({ message: 'Unable to close session. Please try again or contact support.' });
        }
        res.status(500).json({ message: error.message });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const sessions = await Session.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'closedByUser',
                    attributes: ['id', 'username', 'role']
                }
            ]
        });
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
