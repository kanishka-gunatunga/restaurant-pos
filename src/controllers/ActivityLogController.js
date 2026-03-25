const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const UserDetail = require('../models/UserDetail');
const Branch = require('../models/Branch');
const Order = require('../models/Order');
const { Op } = require('sequelize');

/** Map DB user.role to API role for activity log UI (cashier | manager | admin). */
function apiRoleFromDbRole(dbRole) {
    if (!dbRole) return 'cashier';
    const r = String(dbRole).toLowerCase().trim();
    if (r === 'admin') return 'admin';
    if (r === 'manager') return 'manager';
    if (r === 'cashier' || r === 'kitchen') return 'cashier';
    return 'cashier';
}

function parseUserRoleFilter(userRole) {
    if (userRole == null || userRole === '') return null;
    const raw = String(userRole).trim();
    const lower = raw.toLowerCase();
    if (lower === 'all' || lower === 'all roles') return null;
    if (lower === 'cashier') return { [Op.in]: ['cashier', 'kitchen'] };
    if (lower === 'manager' || lower === 'admin') return lower;
    return null;
}

function mapActivityLogRow(log) {
    const plain = log.get ? log.get({ plain: true }) : log;
    const u = plain.user;
    const dbRole = u?.role;
    const role = apiRoleFromDbRole(dbRole);
    const userName = u?.UserDetail?.name || u?.employeeId || 'Unknown';

    const branchName = plain.branch?.name ?? null;
    const hasManagerApproval = plain.managerId != null;

    return {
        id: plain.id,
        dateTime: plain.createdAt,
        createdAt: plain.createdAt,
        activityType: plain.activityType,
        description: plain.description,
        userName,
        user_name: userName,
        role,
        branchName,
        branch_name: branchName,
        orderId: plain.orderId,
        order_id: plain.orderId,
        amount: plain.amount != null ? Number(plain.amount) : null,
        currency: 'Rs.',
        hasManagerApproval,
        has_manager_approval: hasManagerApproval,
    };
}

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
 * Get activity logs with filters (aligned with frontend Activity Log contract).
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
            withManagerApproval,
            page: pageParam,
            limit: limitParam,
        } = req.query;

        let where = {};
        const userWhere = {};

        if (search) {
            where.description = { [Op.like]: `%${search}%` };
        }

        if (activityType != null && String(activityType).trim() !== '') {
            const at = String(activityType).trim();
            const atLower = at.toLowerCase();
            if (atLower !== 'all' && at !== 'All Types') {
                where.activityType = at;
            }
        }

        if (branchId != null && branchId !== '' && String(branchId) !== 'All Branches') {
            const bid = parseInt(String(branchId), 10);
            if (!Number.isNaN(bid)) where.branchId = bid;
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

        if (withManagerApproval === 'true' || withManagerApproval === true) {
            where.managerId = { [Op.ne]: null };
        }

        const roleFilter = parseUserRoleFilter(userRole);
        if (roleFilter != null) {
            userWhere.role = roleFilter;
        }

        const hasPagination =
            (pageParam !== undefined && pageParam !== '') ||
            (limitParam !== undefined && limitParam !== '');
        const page = Math.max(1, parseInt(pageParam, 10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(limitParam, 10) || 25));

        const include = [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'employeeId', 'role'],
                where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
                required: Object.keys(userWhere).length > 0,
                include: [{
                    model: UserDetail,
                    as: 'UserDetail',
                    attributes: ['name'],
                }],
            },
            {
                model: Branch,
                as: 'branch',
                attributes: ['id', 'name'],
                required: false,
            },
            {
                model: User,
                as: 'manager',
                attributes: ['id', 'employeeId'],
                required: false,
                include: [{
                    model: UserDetail,
                    as: 'UserDetail',
                    attributes: ['name'],
                }],
            },
            {
                model: Order,
                as: 'order',
                attributes: ['id', 'totalAmount'],
                required: false,
            },
        ];

        const order = [['createdAt', 'DESC']];
        const findOptions = {
            where,
            include,
            order,
            distinct: true,
            col: 'id',
        };

        if (hasPagination) {
            findOptions.limit = limit;
            findOptions.offset = (page - 1) * limit;
        }

        const { rows, count } = await ActivityLog.findAndCountAll(findOptions);

        const items = rows.map(mapActivityLogRow);

        res.json({
            items,
            total: count,
            ...(hasPagination ? { page, limit } : {}),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
