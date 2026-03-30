const { Op } = require('sequelize');
const UserDetail = require('../models/UserDetail');

/**
 * Admins see all orders across branches (list, search, detail, mutations).
 * Cashier / manager / kitchen remain scoped to user_details.branch_id.
 */
function isAdminOrderScopeBypass(req) {
    return req?.user?.role === 'admin';
}

async function getRequesterBranchContext(req) {
    if (!req?.user?.id) return null;
    const userDetail = await UserDetail.findOne({
        where: { userId: req.user.id },
        attributes: ['branchId'],
    });
    return {
        userId: req.user.id,
        branchId: userDetail?.branchId != null ? Number(userDetail.branchId) : null,
    };
}

async function resolveOrderBranchWhereClause(req) {
    if (isAdminOrderScopeBypass(req)) {
        return {};
    }

    const ctx = await getRequesterBranchContext(req);
    if (!ctx) {
        return { id: -1 };
    }
    if (ctx.branchId == null) {
        return { userId: ctx.userId };
    }
    const usersInBranch = await UserDetail.findAll({
        where: { branchId: ctx.branchId },
        attributes: ['userId'],
    });
    const userIds = [...new Set(usersInBranch.map((u) => u.userId).filter((id) => id != null))];
    if (userIds.length === 0) {
        return { id: -1 };
    }
    return {
        [Op.or]: [{ branchId: ctx.branchId }, { branchId: null, userId: { [Op.in]: userIds } }],
    };
}

async function orderBelongsToRequesterBranch(req, order) {
    if (!req?.user || !order) return false;
    if (isAdminOrderScopeBypass(req)) {
        return true;
    }

    const ctx = await getRequesterBranchContext(req);
    if (!ctx) return false;

    const bid = order.branchId != null ? Number(order.branchId) : null;
    const uid = order.userId != null ? Number(order.userId) : null;

    if (ctx.branchId == null) {
        return uid === ctx.userId;
    }
    if (bid != null) {
        return bid === ctx.branchId;
    }
    if (uid == null) return false;
    const row = await UserDetail.findOne({
        where: { userId: uid, branchId: ctx.branchId },
    });
    return !!row;
}

module.exports = {
    getRequesterBranchContext,
    resolveOrderBranchWhereClause,
    orderBelongsToRequesterBranch,
    isAdminOrderScopeBypass,
};
