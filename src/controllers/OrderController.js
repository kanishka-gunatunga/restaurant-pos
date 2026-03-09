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
const { decrypt } = require('../utils/crypto');
const { Op } = require('sequelize');

exports.searchOrders = async (req, res) => {
    try {
        const { q, orderId, customerName, phone } = req.query;
        let where = {};

        if (q) {
            // General search by ID or name or phone
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
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['id', 'status', 'amount', 'paymentMethod', 'createdAt']
                },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: Variation, as: 'variation' }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Add paymentStatus virtual field
        const processedOrders = orders.map(order => {
            const orderData = order.toJSON();
            const latestPayment = orderData.payments && orderData.payments.length > 0
                ? orderData.payments.reduce((latest, current) =>
                    new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
                )
                : null;

            orderData.paymentStatus = latestPayment ? latestPayment.status : 'pending';
            return orderData;
        });

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
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['id', 'status', 'amount', 'paymentMethod', 'createdAt']
                },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: Variation, as: 'variation' }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Add paymentStatus virtual field and filter by it if requested
        let processedOrders = orders.map(order => {
            const orderData = order.toJSON();
            const latestPayment = orderData.payments && orderData.payments.length > 0
                ? orderData.payments.reduce((latest, current) =>
                    new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
                )
                : null;

            orderData.paymentStatus = latestPayment ? latestPayment.status : 'pending';
            return orderData;
        });

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
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['id', 'status', 'amount', 'paymentMethod', 'createdAt']
                },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: Variation, as: 'variation' },
                        {
                            model: OrderItemModification,
                            as: 'modifications',
                            include: [{ model: ModificationItem, as: 'modification' }]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const processedOrders = orders.map(order => {
            const orderData = order.toJSON();
            const latestPayment = orderData.payments && orderData.payments.length > 0
                ? orderData.payments.reduce((latest, current) =>
                    new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
                )
                : null;

            orderData.paymentStatus = latestPayment ? latestPayment.status : 'pending';
            return orderData;
        });

        res.json(processedOrders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findByPk(id, {
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['id', 'status', 'amount', 'paymentMethod', 'createdAt']
                },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: Variation, as: 'variation' },
                        {
                            model: OrderItemModification,
                            as: 'modifications',
                            include: [{ model: ModificationItem, as: 'modification' }]
                        }
                    ]
                }
            ]
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const orderData = order.toJSON();
        const latestPayment = orderData.payments && orderData.payments.length > 0
            ? orderData.payments.reduce((latest, current) =>
                new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
            )
            : null;

        orderData.paymentStatus = latestPayment ? latestPayment.status : 'pending';

        res.json(orderData);
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
            order_products // Array of products with variations and modifications
        } = req.body;

        let { customerId } = req.body;

        // Find or create customer if mobile is provided
        if (customerMobile) {
            let customer = await Customer.findOne({ where: { mobile: customerMobile }, transaction: t });
            if (!customer && customerName) {
                customer = await Customer.create({ mobile: customerMobile, name: customerName }, { transaction: t });
            }
            if (customer) {
                customerId = customer.id;
            }
        }

        const order = await Order.create({
            customerId,
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

        await t.commit();

        // Fetch the complete order to return
        const fullOrder = await Order.findByPk(order.id, {
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'mobile']
                },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: Variation, as: 'variation' },
                        {
                            model: OrderItemModification,
                            as: 'modifications',
                            include: [{ model: ModificationItem, as: 'modification' }]
                        }
                    ]
                }
            ]
        });

        res.status(201).json(fullOrder);
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        console.error('Create Order Error:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectReason, passcode } = req.body;

        const order = await Order.findByPk(id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Passcode check for cancellation
        if (status === 'cancel') {
            const isVerified = await verifyManagerPasscode(passcode);
            if (!isVerified) {
                return res.status(401).json({ message: 'Invalid or missing manager passcode for cancellation' });
            }
        }

        const updateData = { status };
        if (status === 'hold') {
            updateData.rejectReason = rejectReason;
        }

        await order.update(updateData);
        const updatedOrder = await Order.findByPk(id);
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
            passcode
        } = req.body;

        const order = await Order.findByPk(id);
        if (!order) {
            await t.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        // Passcode check for non-pending orders
        if (order.status !== 'pending') {
            const isVerified = await verifyManagerPasscode(passcode);
            if (!isVerified) {
                await t.rollback();
                return res.status(401).json({ message: 'Invalid or missing manager passcode for updating a non-pending order' });
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

        await order.update({
            customerId,
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
            deliveryInstructions
        }, { transaction: t });

        if (order_products) {
            // Delete existing items and recreate to simplify update logic
            // In a production app, you might want to sync instead of re-creating
            const orderItems = await OrderItem.findAll({ where: { orderId: id } });
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

        await t.commit();
        const fullOrder = await Order.findByPk(order.id, {
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'mobile']
                },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: Variation, as: 'variation' },
                        {
                            model: OrderItemModification,
                            as: 'modifications',
                            include: [{ model: ModificationItem, as: 'modification' }]
                        }
                    ]
                }
            ]
        });

        res.json(fullOrder);
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

