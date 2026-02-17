const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderItemModification = require('../models/OrderItemModification');
const Product = require('../models/Product');
const Variation = require('../models/Variation');
const Modification = require('../models/Modification');
const sequelize = require('../config/database');

exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.findAll({
            include: [
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: Variation, as: 'variation' },
                        {
                            model: OrderItemModification,
                            as: 'modifications',
                            include: [{ model: Modification, as: 'modification' }]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(orders);
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
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: Variation, as: 'variation' },
                        {
                            model: OrderItemModification,
                            as: 'modifications',
                            include: [{ model: Modification, as: 'modification' }]
                        }
                    ]
                }
            ]
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            customerId,
            totalAmount,
            orderType,
            tableNumber,
            orderDiscount,
            tax,
            orderNote,
            kitchenNote,
            orderTimer,
            order_products // Array of products with variations and modifications
        } = req.body;

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
            status: 'pending'
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
                        modificationId: mod.modificationId,
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
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: Variation, as: 'variation' },
                        {
                            model: OrderItemModification,
                            as: 'modifications',
                            include: [{ model: Modification, as: 'modification' }]
                        }
                    ]
                }
            ]
        });

        res.status(201).json(fullOrder);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectReason } = req.body;

        const updateData = { status };
        if (status === 'reject') {
            updateData.rejectReason = rejectReason;
        }

        const [updated] = await Order.update(updateData, { where: { id } });

        if (updated) {
            const updatedOrder = await Order.findByPk(id);
            return res.json(updatedOrder);
        }

        res.status(404).json({ message: 'Order not found' });
    } catch (error) {
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
                        include: [{ model: Modification, as: 'modification' }]
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

