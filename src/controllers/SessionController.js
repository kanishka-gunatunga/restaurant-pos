const Session = require('../models/Session');
const SessionTransaction = require('../models/SessionTransaction');
const User = require('../models/User');
const UserDetail = require('../models/UserDetail');
const { logActivity } = require('./ActivityLogController');
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

        await logActivity({
            userId,
            branchId,
            activityType: 'Session Started',
            description: `Session #${session.id} started by ${req.user.employeeId} with balance Rs.${startBalance || 0}`,
            managerId: manager.id,
            amount: startBalance || 0,
            metadata: { sessionId: session.id, startBalance }
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

        const userDetail = await UserDetail.findOne({ where: { userId } });
        await logActivity({
            userId,
            branchId: userDetail?.branchId || 1,
            activityType: type === 'add' ? 'Cash In' : 'Cash Out',
            description: `${type === 'add' ? 'Cash In' : 'Cash Out'} of Rs.${amount} performed during session #${session.id}`,
            managerId: manager.id,
            amount,
            metadata: { sessionId: session.id, type, description }
        });

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
        const { passcode, actualBalance } = req.body;

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
            closedBy: manager.id,
            actualBalance: actualBalance !== undefined ? actualBalance : null
        }, { transaction: t });

        await t.commit();

        const userDetail = await UserDetail.findOne({ where: { userId } });
        await logActivity({
            userId,
            branchId: userDetail?.branchId || 1,
            activityType: 'Session Closed',
            description: `Session #${session.id} closed by manager ${manager.id}. Actual balance: Rs.${actualBalance || 0}`,
            managerId: manager.id,
            amount: actualBalance || 0,
            metadata: { sessionId: session.id, actualBalance, expectedBalance: session.currentBalance }
        });

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

const { Op } = require('sequelize');

exports.getTodaySummary = async (req, res) => {
    try {
        const todayRaw = new Date();
        const startOfDay = new Date(todayRaw.getFullYear(), todayRaw.getMonth(), todayRaw.getDate(), 0, 0, 0);
        const endOfDay = new Date(todayRaw.getFullYear(), todayRaw.getMonth(), todayRaw.getDate(), 23, 59, 59);

        const sessions = await Session.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startOfDay, endOfDay]
                }
            },
            include: [{
                model: SessionTransaction,
                as: 'transactions'
            }]
        });

        let totalExpectedBalance = 0;
        let totalCashSales = 0;
        let totalCashOuts = 0;

        sessions.forEach(session => {
            totalExpectedBalance += parseFloat(session.currentBalance || 0);

            if (session.transactions) {
                session.transactions.forEach(tx => {
                    if (tx.type === 'sale') {
                        totalCashSales += parseFloat(tx.amount || 0);
                    } else if (tx.type === 'remove') {
                        totalCashOuts += parseFloat(tx.amount || 0);
                    } else if (tx.type === 'refund') {
                        // Refunds could be considered negative cash sales, but usually we just track sales.
                        // I'm not directly modifying cash sales by refund here for now as UI shows sales and outs
                        // Assuming cash sales might be gross or net. Based on current logic `sale` is positive cash.
                    }
                });
            }
        });

        res.json({
            totalExpectedBalance,
            totalCashSales,
            totalCashOuts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

exports.getTodaySessions = async (req, res) => {
    try {
        const todayRaw = new Date();
        const startOfDay = new Date(todayRaw.getFullYear(), todayRaw.getMonth(), todayRaw.getDate(), 0, 0, 0);
        const endOfDay = new Date(todayRaw.getFullYear(), todayRaw.getMonth(), todayRaw.getDate(), 23, 59, 59);

        const sessions = await Session.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startOfDay, endOfDay]
                }
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'employeeId'],
                    include: [{
                        model: UserDetail,
                        as: 'UserDetail',
                        attributes: ['name']
                    }]
                },
                {
                    model: SessionTransaction,
                    as: 'transactions'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const formattedSessions = sessions.map(session => {
            let cashSales = 0;
            let cashSalesCount = 0;
            let cashOuts = 0;
            let cashOutsCount = 0;
            let cashIns = 0; // if 'add'

            if (session.transactions) {
                session.transactions.forEach(tx => {
                    if (tx.type === 'sale') {
                        cashSales += parseFloat(tx.amount || 0);
                        cashSalesCount++;
                    } else if (tx.type === 'remove') {
                        cashOuts += parseFloat(tx.amount || 0);
                        cashOutsCount++;
                    } else if (tx.type === 'add') {
                        cashIns += parseFloat(tx.amount || 0);
                    }
                });
            }

            const expectedBalance = parseFloat(session.currentBalance || 0);
            const actualBalance = session.actualBalance !== null ? parseFloat(session.actualBalance) : null;
            let outstanding = 0;
            if (actualBalance !== null) {
                outstanding = expectedBalance - actualBalance;
            }

            return {
                id: session.id,
                cashierName: session.user ? (session.user.UserDetail && session.user.UserDetail.name ? session.user.UserDetail.name : session.user.employeeId) : 'Unknown',
                status: session.status,
                startTime: session.startTime,
                endTime: session.endTime,
                drawerBalance: parseFloat(session.startBalance || 0),
                cashSales: { amount: cashSales, count: cashSalesCount },
                cashOuts: { amount: cashOuts, count: cashOutsCount },
                cashIns,
                expectedBalance,
                actualBalance,
                outstanding
            };
        });

        res.json(formattedSessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllHistory = async (req, res) => {
    try {
        const { cashierId, discrepancy, fromDate, toDate } = req.query;
        let whereClause = {};

        // Fetch all sessions (open and closed)
        // whereClause.status = 'closed'; 

        if (cashierId) {
            whereClause.userId = cashierId;
        }

        if (fromDate || toDate) {
            whereClause.createdAt = {};
            if (fromDate) {
                whereClause.createdAt[Op.gte] = new Date(new Date(fromDate).setHours(0, 0, 0, 0));
            }
            if (toDate) {
                whereClause.createdAt[Op.lte] = new Date(new Date(toDate).setHours(23, 59, 59, 999));
            }
        }

        const sessions = await Session.findAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'employeeId'],
                    include: [{
                        model: UserDetail,
                        as: 'UserDetail',
                        attributes: ['name']
                    }]
                },
                {
                    model: User,
                    as: 'closedByUser',
                    attributes: ['id', 'employeeId'],
                    include: [{
                        model: UserDetail,
                        as: 'UserDetail',
                        attributes: ['name']
                    }]
                },
                {
                    model: SessionTransaction,
                    as: 'transactions'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const formattedSessions = sessions.map(session => {
            let cashSales = 0;
            let cashSalesCount = 0;
            let cashOuts = 0;
            let cashOutsCount = 0;

            if (session.transactions) {
                session.transactions.forEach(tx => {
                    if (tx.type === 'sale') {
                        cashSales += parseFloat(tx.amount || 0);
                        cashSalesCount++;
                    } else if (tx.type === 'remove') {
                        cashOuts += parseFloat(tx.amount || 0);
                        cashOutsCount++;
                    }
                });
            }

            const expectedBalance = parseFloat(session.currentBalance || 0);
            const actualBalance = session.actualBalance !== null ? parseFloat(session.actualBalance) : expectedBalance;
            const difference = actualBalance - expectedBalance;

            let sessionDiscrepancy = 'balanced';
            if (difference > 0) {
                sessionDiscrepancy = 'overage';
            } else if (difference < 0) {
                sessionDiscrepancy = 'shortage';
            }

            return {
                id: session.id,
                cashierId: session.userId,
                cashierName: session.user ? (session.user.UserDetail && session.user.UserDetail.name ? session.user.UserDetail.name : session.user.employeeId) : 'Unknown',
                date: session.startTime,
                startTime: session.startTime,
                endTime: session.endTime,
                initial: parseFloat(session.startBalance || 0),
                cashSales: { amount: cashSales, count: cashSalesCount },
                cashOuts: { amount: cashOuts, count: cashOutsCount },
                expected: expectedBalance,
                actual: actualBalance,
                difference: difference,
                discrepancy: sessionDiscrepancy,
                closedBy: session.closedByUser ? (session.closedByUser.UserDetail && session.closedByUser.UserDetail.name ? session.closedByUser.UserDetail.name : session.closedByUser.employeeId) : 'Unknown'
            };
        });

        // Filter by discrepancy after calculating
        let finalResult = formattedSessions;
        if (discrepancy) {
            const types = discrepancy.split(',').map(t => t.toLowerCase().trim());
            // Map the frontend values to actual
            finalResult = finalResult.filter(s => types.includes(s.discrepancy));
        }

        res.json(finalResult);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
