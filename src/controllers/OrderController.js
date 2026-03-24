const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderItemModification = require('../models/OrderItemModification');
const Product = require('../models/Product');
const Variation = require('../models/Variation');
const Modification = require('../models/Modification');
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
        { model: Variation, as: 'variation' },
    ],
};

const orderItemsFullInclude = {
    model: OrderItem,
    as: 'items',
    include: [
        { model: Product, as: 'product' },
        { model: Variation, as: 'variation' },
        {
            model: OrderItemModification,
            as: 'modifications',
            include: [{ model: ModificationItem, as: 'modification' }],
        },
    ],
};

exports.searchOrders = async (req, res) => {
    try {
        const { q, orderId, customerName, phone } = req.query;
        let where = {};

        if (q) {
            where = {
                [Op.or]: [
                    { id: { [Op.like]: `%${q}%` } },
                    { '$customer.name$': { [Op.like]: `%${q}%` } },
                    { '$customer.mobile$': { [Op.like]: `%${q}%` } }
                ]
            };
        } else {
            if (orderId) where.id = { [Op.like]: `%${orderId}%` };
            if (customerName) where['$customer.name$'] = { [Op.like]: `%${customerName}%` };
            if (phone) where['$customer.mobile$'] = { [Op.like]: `%${phone}%` };
        }

        const orders = await Order.findAll({
            where,
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsBasicInclude],
            order: [['createdAt', 'DESC']]
        });

        const processedOrders = orders.map((order) => attachDerivedPaymentFieldsToOrderJson(order.toJSON()));

        res.json(processedOrders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.filterOrdersByStatus = async (req, res) => {
    try {
        const { status, paymentStatus } = req.query;

        let where = {};
        if (status) {
            where.status = status;
        }

        const orders = await Order.findAll({
            where,
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsBasicInclude],
            order: [['createdAt', 'DESC']]
        });

        let processedOrders = orders.map((order) => attachDerivedPaymentFieldsToOrderJson(order.toJSON()));

        if (paymentStatus) {
            processedOrders = processedOrders.filter(order => order.paymentStatus === paymentStatus);
        }

        res.json(processedOrders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getOrdersExcludeStatus = async (req, res) => {
    try {
        const { status, paymentStatus } = req.query;

        let where = {};
        if (status) {
            where.status = { [Op.ne]: status };
        }

        const orders = await Order.findAll({
            where,
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsFullInclude],
            order: [['createdAt', 'DESC']]
        });

        let processedOrders = orders.map((order) => attachDerivedPaymentFieldsToOrderJson(order.toJSON()));

        if (paymentStatus) {
            processedOrders = processedOrders.filter(order => order.paymentStatus === paymentStatus);
        }

        res.json(processedOrders);
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
        const orders = await Order.findAll({
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsFullInclude],
            order: [['createdAt', 'DESC']]
        });

        const processedOrders = orders.map((order) => attachDerivedPaymentFieldsToOrderJson(order.toJSON()));

        res.json(processedOrders);
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

        res.json(attachDerivedPaymentFieldsToOrderJson(order.toJSON()));
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
            order_products
        } = req.body;

        let { customerId } = req.body;

        const parsedOrderDiscount =
            orderDiscount !== undefined && orderDiscount !== null
                ? Math.max(0, parseFloat(orderDiscount) || 0)
                : 0;

        if (customerMobile) {
            let customer = await Customer.findOne({ where: { mobile: customerMobile }, transaction: t });
            if (!customer && customerName) {
                customer = await Customer.create({ mobile: customerMobile, name: customerName }, { transaction: t });
            }
            if (customer) {
                customerId = customer.id;
            }
        }

        const preliminaryTotals = computeOrderTotalsFromLines(order_products || [], parsedOrderDiscount);

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
            userId: req.user?.id
        }, { transaction: t });


        if (order_products && order_products.length > 0) {
            for (const item of order_products) {
                const orderItem = await OrderItem.create({
                    orderId: order.id,
                    productId: item.productId,
                    variationId: item.variationId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    productDiscount: item.productDiscount,
                    status: 'pending'
                }, { transaction: t });

                if (item.modifications && item.modifications.length > 0) {
                    const modifications = item.modifications.map(mod => ({
                        orderItemId: orderItem.id,
                        modificationId: mod.id || mod.modificationItemId || mod.modificationId,
                        price: mod.price
                    }));
                    await OrderItemModification.bulkCreate(modifications, { transaction: t });
                }
            }
        }

        const savedItems = await OrderItem.findAll({
            where: { orderId: order.id },
            include: [{ model: OrderItemModification, as: 'modifications' }],
            transaction: t
        });
        const finalTotals = computeOrderTotalsFromLines(savedItems, parsedOrderDiscount);
        logTotalsMismatchIfAny(order.id, tax, totalAmount, finalTotals, 'createOrder');
        await order.update(
            {
                tax: finalTotals.tax,
                totalAmount: finalTotals.totalAmount,
                orderDiscount: parsedOrderDiscount
            },
            { transaction: t }
        );

        await syncBalanceDuePayment(order.id, finalTotals.totalAmount, t);
        await persistOrderPaymentAggregate(order.id, t);

        await t.commit();

        const fullOrder = await Order.findByPk(order.id, {
            include: [customerOrderInclude, paymentsOrderInclude, orderItemsFullInclude],
        });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Order Placed',
            description: `New order ${order.id} placed for ${orderType} at ${tableNumber || 'N/A'}`,
            orderId: order.id,
            amount: finalTotals.totalAmount,
            metadata: { orderType, tableNumber, totalAmount: finalTotals.totalAmount }
        });

        res.status(201).json(attachDerivedPaymentFieldsToOrderJson(fullOrder.toJSON()));
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
    return attachDerivedPaymentFieldsToOrderJson(full.toJSON());
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

                await syncBalanceDuePayment(id, orderLocked.totalAmount, t);
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
        } = req.body;

        const order = await Order.findByPk(id, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

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

        if (order_products) {
            const orderItems = await OrderItem.findAll({ where: { orderId: id }, transaction: t });
            for (const item of orderItems) {
                await OrderItemModification.destroy({ where: { orderItemId: item.id }, transaction: t });
            }
            await OrderItem.destroy({ where: { orderId: id }, transaction: t });

            if (order_products.length > 0) {
                for (const item of order_products) {
                    const orderItem = await OrderItem.create({
                        orderId: order.id,
                        productId: item.productId,
                        variationId: item.variationId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        productDiscount: item.productDiscount,
                        status: item.status || 'pending'
                    }, { transaction: t });

                    if (item.modifications && item.modifications.length > 0) {
                        const modifications = item.modifications.map(mod => ({
                            orderItemId: orderItem.id,
                            modificationId: mod.id || mod.modificationItemId || mod.modificationId,
                            price: mod.price
                        }));
                        await OrderItemModification.bulkCreate(modifications, { transaction: t });
                    }
                }
            }
        }

        const savedItems = await OrderItem.findAll({
            where: { orderId: id },
            include: [{ model: OrderItemModification, as: 'modifications' }],
            transaction: t
        });
        const finalTotals = computeOrderTotalsFromLines(savedItems, effectiveOrderDiscount);
        logTotalsMismatchIfAny(id, tax, totalAmount, finalTotals, 'updateOrder');

        await order.update(
            {
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
                deliveryInstructions
            },
            { transaction: t }
        );

        await syncBalanceDuePayment(id, finalTotals.totalAmount, t);
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
        const clientPayStatus = bodyPaymentStatus !== undefined ? bodyPaymentStatus : bodyPaymentStatusSnake;
        logIgnoredClientPaymentStatus(id, clientPayStatus, payload.paymentStatus);

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

        const [updated] = await OrderItem.update({ status }, { where: { id: itemId } });

        if (updated) {
            const updatedItem = await OrderItem.findByPk(itemId, {
                include: [
                    { model: Product, as: 'product' },
                    { model: Variation, as: 'variation' },
                    {
                        model: OrderItemModification,
                        as: 'modifications',
                        include: [{ model: ModificationItem, as: 'modification' }]
                    }
                ]
            });
            return res.json(updatedItem);
        }

        res.status(404).json({ message: 'Order item not found' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

