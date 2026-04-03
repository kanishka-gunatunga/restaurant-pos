const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderItemModification = require('../models/OrderItemModification');
const Product = require('../models/Product');
const Variation = require('../models/Variation');
const VariationOption = require('../models/VariationOption');
const ModificationItem = require('../models/ModificationItem');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Payment = require('../models/Payment');
const sequelize = require('../config/database');
const { Op, Transaction } = require('sequelize');
const { decrypt } = require('../utils/crypto');
const Session = require('../models/Session');
const SessionTransaction = require('../models/SessionTransaction');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');
const PrintJob = require('../models/PrintJob');
const Branch = require('../models/Branch');
const templateService = require('../services/templateService');
const Pusher = require('pusher');

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
});

const { resolveOrderBranchWhereClause, orderBelongsToRequesterBranch } = require('../utils/orderBranchScope');
const { computeOrderTotalsFromLines, logTotalsMismatchIfAny, roundMoney } = require('../utils/orderTotals');
const { auditLog } = require('../utils/auditLogger');
const {
    PAYMENT_LIST_ATTRIBUTES,
    attachDerivedPaymentFieldsToOrderJson,
    syncBalanceDuePayment,
    persistOrderPaymentAggregate,
    logIgnoredClientPaymentStatus,
    getTolerance,
} = require('../utils/orderPaymentState');
const { invalidManagerPasscode } = require('../utils/managerPasscodeResponse');
const { enrichOrderJsonItemsForDetail } = require('../utils/orderItemDetailPayload');
const {
    parseOrderListPagination,
    mergePlacedByMeFilter,
    normalizePaymentStatusForSql,
    findOrdersPage,
} = require('../utils/orderListQuery');

async function enrichOrderListItem(json) {
    const out = attachDerivedPaymentFieldsToOrderJson({ ...json });
    await enrichOrderJsonItemsForDetail(out);
    return out;
}

const customerOrderInclude = {
    model: Customer,
    as: 'customer',
    attributes: ['id', 'name', 'mobile'],
};

const paymentsOrderInclude = {
    model: Payment,
    as: 'payments',
    attributes: PAYMENT_LIST_ATTRIBUTES,
};

const orderItemsBasicInclude = {
    model: OrderItem,
    as: 'items',
    include: [
        { model: Product, as: 'product' },
        {
            model: VariationOption,
            as: 'variationOption',
            include: [{ model: Variation, as: 'Variation' }]
        },
        {
            model: OrderItemModification,
            as: 'modifications',
            attributes: ['id', 'orderItemId', 'modificationId', 'price'],
            include: [
                {
                    model: ModificationItem,
                    as: 'modification',
                    attributes: ['id', 'title', 'price', 'modificationId'],
                },
            ],
        },
    ],
};

const orderItemsFullInclude = orderItemsBasicInclude;

function buildOrderItemModificationRows(orderItemId, modifications) {
    if (!modifications?.length) {
        return [];
    }
    const rows = [];
    for (const mod of modifications) {
        const modId = mod.id ?? mod.modificationItemId ?? mod.modificationId;
        if (modId == null) {
            continue;
        }
        const qty = Math.max(1, parseInt(mod.quantity, 10) || 1);
        for (let i = 0; i < qty; i++) {
            rows.push({
                orderItemId,
                modificationId: modId,
                price: mod.price,
            });
        }
    }
    return rows;
}

exports.searchOrders = async (req, res) => {
    try {
        const { q, orderId, customerName, phone } = req.query;
        const branchWhere = await resolveOrderBranchWhereClause(req);

        let where;
        if (q) {
            where = {
                [Op.and]: [
                    branchWhere,
                    {
                        [Op.or]: [
                            { id: { [Op.like]: `%${q}%` } },
                            { '$customer.name$': { [Op.like]: `%${q}%` } },
                            { '$customer.mobile$': { [Op.like]: `%${q}%` } },
                        ],
                    },
                ],
            };
        } else {
            const extra = {};
            if (orderId) extra.id = { [Op.like]: `%${orderId}%` };
            if (customerName) extra['$customer.name$'] = { [Op.like]: `%${customerName}%` };
            if (phone) extra['$customer.mobile$'] = { [Op.like]: `%${phone}%` };
            where =
                Object.keys(extra).length > 0 ? { [Op.and]: [branchWhere, extra] } : branchWhere;
        }

        const { where: scopedWhere, placedByMe } = mergePlacedByMeFilter(req, where);
        const { page, pageSize, offset } = parseOrderListPagination(req);
        const result = await findOrdersPage({
            where: scopedWhere,
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsBasicInclude],
            order: [['createdAt', 'DESC']],
            page,
            pageSize,
            offset,
            processRow: enrichOrderListItem,
        });

        res.json({ data: result.data, meta: { ...result.meta, placedByMe } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.filterOrdersByStatus = async (req, res) => {
    try {
        const { status, paymentStatus } = req.query;

        const branchWhere = await resolveOrderBranchWhereClause(req);
        let where =
            status != null && String(status).trim() !== ''
                ? { [Op.and]: [branchWhere, { status }] }
                : branchWhere;

        const psSql = normalizePaymentStatusForSql(paymentStatus);
        if (psSql) {
            where = { [Op.and]: [where, { paymentStatus: psSql }] };
        }

        const { where: scopedWhere, placedByMe } = mergePlacedByMeFilter(req, where);
        const { page, pageSize, offset } = parseOrderListPagination(req);
        const result = await findOrdersPage({
            where: scopedWhere,
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsBasicInclude],
            order: [['createdAt', 'DESC']],
            page,
            pageSize,
            offset,
            processRow: enrichOrderListItem,
        });

        res.json({ data: result.data, meta: { ...result.meta, placedByMe } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getOrdersExcludeStatus = async (req, res) => {
    try {
        const { status, paymentStatus } = req.query;

        const branchWhere = await resolveOrderBranchWhereClause(req);
        let where =
            status != null && String(status).trim() !== ''
                ? { [Op.and]: [branchWhere, { status: { [Op.ne]: status } }] }
                : branchWhere;

        const psSql = normalizePaymentStatusForSql(paymentStatus);
        if (psSql) {
            where = { [Op.and]: [where, { paymentStatus: psSql }] };
        }

        const { where: scopedWhere, placedByMe } = mergePlacedByMeFilter(req, where);
        const { page, pageSize, offset } = parseOrderListPagination(req);
        const result = await findOrdersPage({
            where: scopedWhere,
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsFullInclude],
            order: [['createdAt', 'DESC']],
            page,
            pageSize,
            offset,
            processRow: enrichOrderListItem,
        });

        res.json({ data: result.data, meta: { ...result.meta, placedByMe } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

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
            return true;
        }
    }
    return false;
};

exports.getAllOrders = async (req, res) => {
    try {
        const branchWhere = await resolveOrderBranchWhereClause(req);
        const { where: scopedWhere, placedByMe } = mergePlacedByMeFilter(req, branchWhere);
        const { page, pageSize, offset } = parseOrderListPagination(req);
        const result = await findOrdersPage({
            where: scopedWhere,
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsFullInclude],
            order: [['createdAt', 'DESC']],
            page,
            pageSize,
            offset,
            processRow: enrichOrderListItem,
        });

        res.json({ data: result.data, meta: { ...result.meta, placedByMe } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findByPk(id, {
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsFullInclude],
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (!(await orderBelongsToRequesterBranch(req, order))) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const payload = attachDerivedPaymentFieldsToOrderJson(order.toJSON());
        await enrichOrderJsonItemsForDetail(payload);
        res.json(payload);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            customerMobile,
            customerName,
            totalAmount,
            orderType,
            tableNumber,
            orderDiscount,
            tax,
            orderNote,
            kitchenNote,
            orderTimer,
            deliveryAddress,
            landmark,
            zipcode,
            deliveryInstructions,
            order_products,
            serviceCharge,
            deliveryChargeAmount,
            deliveryChargeId,
            deliveryChargeSelectedId
        } = req.body;

        let { customerId } = req.body;

        const parsedOrderDiscount =
            orderDiscount !== undefined && orderDiscount !== null
                ? Math.max(0, parseFloat(orderDiscount) || 0)
                : 0;

        const effectiveServiceCharge = parseFloat(serviceCharge) || 0;
        const effectiveDeliveryChargeAmount = parseFloat(deliveryChargeAmount) || 0;
        const effectiveDeliveryChargeId = deliveryChargeId || deliveryChargeSelectedId || null;

        if (customerMobile) {
            let customer = await Customer.findOne({ where: { mobile: customerMobile }, transaction: t });
            if (!customer && customerName) {
                customer = await Customer.create({ mobile: customerMobile, name: customerName }, { transaction: t });
            }
            if (customer) {
                customerId = customer.id;
            }
        }

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id }, transaction: t });

        const preliminaryTotals = computeOrderTotalsFromLines(order_products || [], parsedOrderDiscount, effectiveServiceCharge, effectiveDeliveryChargeAmount);

        const order = await Order.create({
            customerId,
            totalAmount: preliminaryTotals.totalAmount,
            orderType,
            tableNumber,
            orderDiscount: parsedOrderDiscount,
            tax: preliminaryTotals.tax,
            orderNote,
            kitchenNote,
            orderTimer,
            deliveryAddress,
            landmark,
            zipcode,
            deliveryInstructions,
            status: 'pending',
            userId: req.user?.id,
            branchId: userDetail?.branchId ?? null,
            serviceCharge: effectiveServiceCharge,
            deliveryChargeAmount: effectiveDeliveryChargeAmount,
            deliveryChargeId: effectiveDeliveryChargeId,
        }, { transaction: t });


        if (order_products && order_products.length > 0) {
            for (const item of order_products) {
                const variationOptionId = item.variationId ?? item.variation_id ?? item.variationOptionId ?? null;
                const orderItem = await OrderItem.create({
                    orderId: order.id,
                    productId: item.productId,
                    variationOptionId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    productDiscount: item.productDiscount,
                    status: 'pending'
                }, { transaction: t });

                const modRows = buildOrderItemModificationRows(orderItem.id, item.modifications);
                if (modRows.length > 0) {
                    await OrderItemModification.bulkCreate(modRows, { transaction: t });
                }
            }
        }

        const savedItems = await OrderItem.findAll({
            where: { orderId: order.id },
            include: [{ model: OrderItemModification, as: 'modifications' }],
            transaction: t
        });
        const finalTotals = computeOrderTotalsFromLines(savedItems, parsedOrderDiscount, effectiveServiceCharge, effectiveDeliveryChargeAmount);
        logTotalsMismatchIfAny(order.id, tax, totalAmount, finalTotals, 'createOrder');
        await order.update(
            {
                tax: finalTotals.tax,
                totalAmount: finalTotals.totalAmount,
                orderDiscount: parsedOrderDiscount,
                serviceCharge: effectiveServiceCharge,
                deliveryChargeAmount: effectiveDeliveryChargeAmount
            },
            { transaction: t }
        );

        await syncBalanceDuePayment(order.id, t);
        await persistOrderPaymentAggregate(order.id, t);

        await t.commit();

        const fullOrder = await Order.findByPk(order.id, {
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsFullInclude],
        });

        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Order Placed',
            description: `New order ${order.id} placed for ${orderType} at ${tableNumber || 'N/A'}`,
            orderId: order.id,
            amount: finalTotals.totalAmount,
            metadata: { orderType, tableNumber, totalAmount: finalTotals.totalAmount }
        });

        try {
            await pusher.trigger('orders-channel', 'new-order', {
                message: 'New order created',
                orderId: order.id,
            });
        } catch (error) {
            console.error('Pusher trigger error:', error);
        }

        // Queue Kitchen Print Job
        try {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            const branchId = userDetail?.branchId || 1;
            const branch = await Branch.findByPk(branchId);

            // Fetch full order with all necessary includes for the template
            const printOrder = await Order.findByPk(order.id, {
                include: [
                    {
                        model: OrderItem,
                        as: 'items',
                        include: [
                            { model: Product, as: 'product' },
                            {
                                model: VariationOption,
                                as: 'variationOption',
                                include: [{ model: Variation, as: 'Variation' }]
                            },
                            {
                                model: OrderItemModification,
                                as: 'modifications',
                                include: [{ model: ModificationItem, as: 'modification' }]
                            }
                        ]
                    }
                ]
            });

            const data = templateService.generateKitchenStructuredData(printOrder, branch);
            const content = JSON.stringify(data);
            await PrintJob.create({
                order_id: order.id,
                printer_name: 'XP-80',
                content,
                type: 'kitchen',
                status: 'pending'
            });
        } catch (printError) {
            console.error('[OrderController] Failed to queue kitchen print job for order', order.id, ':', printError);
        }

        const createdPayload = attachDerivedPaymentFieldsToOrderJson(fullOrder.toJSON());
        await enrichOrderJsonItemsForDetail(createdPayload);
        res.status(201).json(createdPayload);
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        console.error('Create Order Error:', error);
        res.status(400).json({ message: error.message });
    }
};

async function loadOrderWithDerivedFields(orderId) {
    const full = await Order.findByPk(orderId, {
        include: [customerOrderInclude, paymentsOrderInclude, orderItemsFullInclude],
    });
    if (!full) return null;
    const json = attachDerivedPaymentFieldsToOrderJson(full.toJSON());
    await enrichOrderJsonItemsForDetail(json);
    return json;
}

exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, rejectReason, passcode } = req.body;

    if (status === 'cancel') {
        try {
            const order = await Order.findByPk(id);
            if (!order) {
                return res.status(404).json({ message: 'Order not found' });
            }
            if (!(await orderBelongsToRequesterBranch(req, order))) {
                return res.status(404).json({ message: 'Order not found' });
            }

            if (order.status === 'cancel') {
                const payload = await loadOrderWithDerivedFields(id);
                return res.json(payload);
            }

            const isVerified = await verifyManagerPasscode(passcode);
            if (!isVerified) {
                return invalidManagerPasscode(
                    res,
                    'Invalid or missing manager passcode for cancellation'
                );
            }

            const t = await sequelize.transaction();
            try {
                const orderLocked = await Order.findByPk(id, {
                    transaction: t,
                    lock: Transaction.LOCK.UPDATE,
                });
                if (!orderLocked) {
                    await t.rollback();
                    return res.status(404).json({ message: 'Order not found' });
                }
                if (!(await orderBelongsToRequesterBranch(req, orderLocked))) {
                    await t.rollback();
                    return res.status(404).json({ message: 'Order not found' });
                }
                if (orderLocked.status === 'cancel') {
                    await t.commit();
                    const payload = await loadOrderWithDerivedFields(id);
                    return res.json(payload);
                }

                const payments = await Payment.findAll({ where: { orderId: id }, transaction: t });
                const tol = getTolerance();

                for (const p of payments) {
                    const st = p.status;
                    if (st === 'pending') {
                        await p.destroy({ transaction: t });
                        continue;
                    }
                    if (st === 'refund') {
                        continue;
                    }

                    const amount = parseFloat(p.amount) || 0;
                    const alreadyRefunded = parseFloat(p.refundedAmount) || 0;
                    const remaining = roundMoney(amount - alreadyRefunded);

                    if (remaining <= tol) {
                        await p.update(
                            { status: 'refund', refundedAmount: amount },
                            { transaction: t }
                        );
                        continue;
                    }

                    await p.update(
                        { status: 'refund', refundedAmount: amount },
                        { transaction: t }
                    );

                    if (p.paymentMethod === 'cash' && remaining > tol) {
                        const session = await Session.findOne({
                            where: { userId: req.user?.id, status: 'open' },
                            transaction: t,
                        });
                        if (session) {
                            await session.update(
                                {
                                    currentBalance:
                                        parseFloat(session.currentBalance) - remaining,
                                },
                                { transaction: t }
                            );
                            await SessionTransaction.create(
                                {
                                    sessionId: session.id,
                                    type: 'refund',
                                    amount: remaining,
                                    paymentId: p.id,
                                    userId: req.user?.id,
                                    description: `Order #${id} cancelled — refund Payment #${p.id}`,
                                },
                                { transaction: t }
                            );
                        }
                    }
                }

                await orderLocked.update({ status: 'cancel' }, { transaction: t });

                await syncBalanceDuePayment(id, t);
                await persistOrderPaymentAggregate(id, t);

                await t.commit();

                const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
                await logActivity({
                    userId: req.user.id,
                    branchId: userDetail?.branchId || 1,
                    activityType: 'Order Cancelled',
                    description: `Order ${id} cancelled; payments reversed in same transaction`,
                    orderId: Number(id),
                    metadata: { prevStatus: orderLocked._previousDataValues?.status, newStatus: 'cancel' },
                });
                auditLog('order_cancelled', {
                    ip: req.ip,
                    userId: req.user.id,
                    metadata: { orderId: Number(id) },
                });

                const payload = await loadOrderWithDerivedFields(id);
                return res.json(payload);
            } catch (err) {
                await t.rollback();
                throw err;
            }
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    try {
        const order = await Order.findByPk(id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (!(await orderBelongsToRequesterBranch(req, order))) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const updateData = { status };
        if (status === 'hold') {
            updateData.rejectReason = rejectReason;
        }

        await order.update(updateData);
        const updatedOrder = await Order.findByPk(id);

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Order Status Updated',
            description: `Order ${id} status updated to ${status}`,
            orderId: order.id,
            metadata: { prevStatus: order._previousDataValues?.status, newStatus: status, rejectReason }
        });

        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const {
            customerMobile,
            customerName,
            totalAmount,
            orderType,
            tableNumber,
            orderDiscount,
            tax,
            orderNote,
            kitchenNote,
            orderTimer,
            deliveryAddress,
            landmark,
            zipcode,
            deliveryInstructions,
            order_products,
            passcode,
            paymentStatus: bodyPaymentStatus,
            payment_status: bodyPaymentStatusSnake,
            serviceCharge,
            deliveryChargeAmount,
            deliveryChargeId,
            deliveryChargeSelectedId
        } = req.body;

        const order = await Order.findByPk(id, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }
        if (!(await orderBelongsToRequesterBranch(req, order))) {
            await t.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        const editorUserDetail = await UserDetail.findOne({
            where: { userId: req.user.id },
            transaction: t,
        });

        if (order.status !== 'pending') {
            const isVerified = await verifyManagerPasscode(passcode);
            if (!isVerified) {
                await t.rollback();
                return invalidManagerPasscode(
                    res,
                    'Invalid or missing manager passcode for updating a non-pending order'
                );
            }
        }

        let { customerId } = req.body;
        if (customerMobile) {
            let customer = await Customer.findOne({ where: { mobile: customerMobile }, transaction: t });
            if (!customer && customerName) {
                customer = await Customer.create({ mobile: customerMobile, name: customerName }, { transaction: t });
            }
            if (customer) {
                customerId = customer.id;
            }
        }

        const effectiveOrderDiscount =
            orderDiscount !== undefined && orderDiscount !== null
                ? Math.max(0, parseFloat(orderDiscount) || 0)
                : Math.max(0, parseFloat(order.orderDiscount) || 0);

        const effectiveServiceCharge = serviceCharge !== undefined ? (parseFloat(serviceCharge) || 0) : (parseFloat(order.serviceCharge) || 0);
        const effectiveDeliveryChargeAmount = deliveryChargeAmount !== undefined ? (parseFloat(deliveryChargeAmount) || 0) : (parseFloat(order.deliveryChargeAmount) || 0);
        const effectiveDeliveryChargeId = (deliveryChargeId || deliveryChargeSelectedId) !== undefined ? (deliveryChargeId || deliveryChargeSelectedId || null) : order.deliveryChargeId;

        if (order_products) {
            const orderItems = await OrderItem.findAll({ where: { orderId: id }, transaction: t });
            for (const item of orderItems) {
                await OrderItemModification.destroy({ where: { orderItemId: item.id }, transaction: t });
            }
            await OrderItem.destroy({ where: { orderId: id }, transaction: t });

            if (order_products.length > 0) {
                for (const item of order_products) {
                    const variationOptionId = item.variationId ?? item.variation_id ?? item.variationOptionId ?? null;
                    const orderItem = await OrderItem.create({
                        orderId: order.id,
                        productId: item.productId,
                        variationOptionId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        productDiscount: item.productDiscount,
                        status: item.status || 'pending'
                    }, { transaction: t });

                    const modRows = buildOrderItemModificationRows(orderItem.id, item.modifications);
                    if (modRows.length > 0) {
                        await OrderItemModification.bulkCreate(modRows, { transaction: t });
                    }
                }
            }
        }

        const savedItems = await OrderItem.findAll({
            where: { orderId: id },
            include: [{ model: OrderItemModification, as: 'modifications' }],
            transaction: t
        });
        const finalTotals = computeOrderTotalsFromLines(savedItems, effectiveOrderDiscount, effectiveServiceCharge, effectiveDeliveryChargeAmount);
        logTotalsMismatchIfAny(id, tax, totalAmount, finalTotals, 'updateOrder');

        const updatePayload = {
            customerId,
            orderType,
            tableNumber,
            orderDiscount: effectiveOrderDiscount,
            tax: finalTotals.tax,
            totalAmount: finalTotals.totalAmount,
            orderNote,
            kitchenNote,
            orderTimer,
            deliveryAddress,
            landmark,
            zipcode,
            deliveryInstructions,
            serviceCharge: effectiveServiceCharge,
            deliveryChargeAmount: effectiveDeliveryChargeAmount,
            deliveryChargeId: effectiveDeliveryChargeId,
        };

        if (order.branchId == null && editorUserDetail?.branchId != null) {
            updatePayload.branchId = editorUserDetail.branchId;
        }
        await order.update(updatePayload, { transaction: t });
        await order.reload({ transaction: t });

        await syncBalanceDuePayment(id, t);
        await persistOrderPaymentAggregate(id, t);

        if (order_products) {
            auditLog('order_basket_updated', {
                ip: req.ip,
                userId: req.user?.id,
                path: req.path,
                metadata: {
                    orderId: Number(id),
                    totalAmount: finalTotals.totalAmount,
                    tax: finalTotals.tax,
                    lineSubtotalSum: finalTotals.lineSubtotalSum,
                },
            });
        }

        await t.commit();
        const fullOrder = await Order.findByPk(order.id, {
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsFullInclude],
        });

        const payload = attachDerivedPaymentFieldsToOrderJson(fullOrder.toJSON());
        await enrichOrderJsonItemsForDetail(payload);
        payload.payment_status = payload.paymentStatus;
        const clientPayStatus = bodyPaymentStatus !== undefined ? bodyPaymentStatus : bodyPaymentStatusSnake;
        logIgnoredClientPaymentStatus(id, clientPayStatus, payload.paymentStatus);

        if (['1', 'true', 'yes'].includes(String(process.env.LOG_PAYMENT_CONSISTENCY || '').toLowerCase())) {
            console.log(
                JSON.stringify({
                    ts: new Date().toISOString(),
                    event: 'order_put_read_after_commit',
                    orderId: Number(id),
                    paymentStatus: payload.paymentStatus,
                    totalAmount: payload.totalAmount,
                    balanceDue: payload.balanceDue,
                    requiresAdditionalPayment: payload.requiresAdditionalPayment,
                })
            );
        }

        res.json(payload);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.updateOrderItemStatus = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { status } = req.body;

        const itemForScope = await OrderItem.findByPk(itemId);
        if (!itemForScope) {
            return res.status(404).json({ message: 'Order item not found' });
        }
        const parentOrder = await Order.findByPk(itemForScope.orderId);
        if (!parentOrder || !(await orderBelongsToRequesterBranch(req, parentOrder))) {
            return res.status(404).json({ message: 'Order item not found' });
        }

        const [updated] = await OrderItem.update({ status }, { where: { id: itemId } });

        if (updated) {
            const updatedItem = await OrderItem.findByPk(itemId, {
                include: [
                    { model: Product, as: 'product' },
                    { model: VariationOption, as: 'variation' },
                    {
                        model: OrderItemModification,
                        as: 'modifications',
                        attributes: ['id', 'orderItemId', 'modificationId', 'price'],
                        include: [
                            {
                                model: ModificationItem,
                                as: 'modification',
                                attributes: ['id', 'title', 'price', 'modificationId'],
                            },
                        ],
                    },
                ],
            });
            const itemJson = updatedItem.toJSON();
            await enrichOrderJsonItemsForDetail({ items: [itemJson] });
            return res.json(itemJson);
        }

        res.status(404).json({ message: 'Order item not found' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

