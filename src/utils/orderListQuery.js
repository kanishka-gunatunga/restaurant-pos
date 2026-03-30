const { Op } = require('sequelize');
const Order = require('../models/Order');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const ORDER_PAYMENT_STATUS_ENUM = new Set(['pending', 'paid', 'partial_refund', 'refund']);

/**
 * @returns {{ page: number, pageSize: number, offset: number }}
 */
function parseOrderListPagination(req) {
    const page = Math.max(1, parseInt(req.query.page, 10) || DEFAULT_PAGE);
    const rawSize = parseInt(req.query.pageSize ?? req.query.limit, 10);
    const pageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Number.isFinite(rawSize) && rawSize > 0 ? rawSize : DEFAULT_PAGE_SIZE)
    );
    return { page, pageSize, offset: (page - 1) * pageSize };
}

function mergePlacedByMeFilter(req, where) {
    const raw = req.query.placedByMe ?? req.query.mine ?? req.query.onlyMine;
    const on = ['1', 'true', 'yes'].includes(String(raw ?? '').toLowerCase().trim());
    if (!on || req.user?.id == null) {
        return { where, placedByMe: false };
    }
    const uid = req.user.id;
    if (!where || Object.keys(where).length === 0) {
        return { where: { userId: uid }, placedByMe: true };
    }
    return { where: { [Op.and]: [where, { userId: uid }] }, placedByMe: true };
}

function normalizePaymentStatusForSql(paymentStatus) {
    if (paymentStatus == null || String(paymentStatus).trim() === '') return null;
    const s = String(paymentStatus).trim().toLowerCase();
    const map = {
        pending: 'pending',
        paid: 'paid',
        partial_refund: 'partial_refund',
        refund: 'refund',
    };
    const normalized = map[s] || (ORDER_PAYMENT_STATUS_ENUM.has(s) ? s : null);
    return normalized && ORDER_PAYMENT_STATUS_ENUM.has(normalized) ? normalized : null;
}

async function findOrdersPage({ where, include, order, page, pageSize, offset, processRow }) {
    const { count, rows } = await Order.findAndCountAll({
        where,
        include,
        order: order || [['createdAt', 'DESC']],
        limit: pageSize,
        offset,
        distinct: true,
        col: 'id',
    });

    const total = typeof count === 'number' ? count : 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    const data = await Promise.all(
        rows.map(async (orderRow) => {
            const json = orderRow.toJSON();
            return processRow ? processRow(json) : json;
        })
    );

    return {
        data,
        meta: {
            total,
            page,
            pageSize,
            totalPages,
        },
    };
}

module.exports = {
    parseOrderListPagination,
    mergePlacedByMeFilter,
    normalizePaymentStatusForSql,
    findOrdersPage,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
};
