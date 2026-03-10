const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const UserDetail = require('../models/UserDetail');
const Branch = require('../models/Branch');
const Order = require('../models/Order');
const { Op } = require('sequelize');

/**
 * Helper to log an activity
 */
exports.logActivity = async ({
    userId,
    branchId,
    activityType,
    description,
    orderId = null,
    amount = null,
    managerId = null,
    metadata = null
}) => {
    try {
        await ActivityLog.create({
            userId,
            branchId,
            activityType,
            description,
            orderId,
            amount,
            managerId,
            metadata
        });
    } catch (error) {
        console.error('Error logging activity:', error);
        // Do not throw error to avoid breaking main application flow
    }
};

/**
 * Get activity logs with filters
 */
exports.getActivityLogs = async (req, res) => {
    try {
        const {
            search,
            activityType,
            userRole,
            branchId,
            fromDate,
            toDate,
            withManagerApproval
        } = req.query;

        let where = {};
        let userWhere = {};

        if (search) {
            where.description = { [Op.like]: `%${search}%` };
        }

        if (activityType && activityType !== 'All Types') {
            where.activityType = activityType;
        }

        if (branchId && branchId !== 'All Branches') {
            where.branchId = branchId;
        }

        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) {
                where.createdAt[Op.gte] = new Date(new Date(fromDate).setHours(0, 0, 0, 0));
            }
            if (toDate) {
                where.createdAt[Op.lte] = new Date(new Date(toDate).setHours(23, 59, 59, 999));
            }
        }

        if (withManagerApproval === 'true') {
            where.managerId = { [Op.ne]: null };
        }

        if (userRole && userRole !== 'All Roles') {
            userWhere.role = userRole;
        }

        const logs = await ActivityLog.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'employeeId', 'role'],
                    where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
                    include: [{
                        model: UserDetail,
                        as: 'UserDetail',
                        attributes: ['name']
                    }]
                },
                {
                    model: Branch,
                    as: 'branch',
                    attributes: ['id', 'name']
                },
                {
                    model: User,
                    as: 'manager',
                    attributes: ['id', 'employeeId'],
                    include: [{
                        model: UserDetail,
                        as: 'UserDetail',
                        attributes: ['name']
                    }]
                },
                {
                    model: Order,
                    as: 'order',
                    attributes: ['id', 'totalAmount']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
