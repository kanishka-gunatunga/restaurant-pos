const { Op } = require('sequelize');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Payment = require('../models/Payment');
const User = require('../models/User');
const UserDetail = require('../models/UserDetail');
const Product = require('../models/Product');
const Variation = require('../models/Variation');

exports.getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, reportType, reportSource, branch } = req.query;
        // branchId corresponds to 'branch' parameter in request
        const branchId = branch;

        if (!startDate || !endDate || !branchId || !reportType || !reportSource) {
            return res.status(400).json({
                message: 'Missing required parameters: startDate, endDate, branch, reportType, reportSource'
            });
        }

        // Normalize reportType and reportSource names to handle subtle variations
        const rt = reportType.toLowerCase().replace(' ', '_');
        const rs = reportSource.toLowerCase();

        // Adjust endDate to include the full day
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const dateFilter = {
            createdAt: {
                [Op.between]: [start, end]
            }
        };

        if (rs === 'order' || rs === 'orders') {
            const orders = await Order.findAll({
                where: dateFilter,
                include: [
                    {
                        model: OrderItem,
                        as: 'items',
                        include: [{ model: Product, as: 'product' }]
                    },
                    {
                        model: User,
                        as: 'user',
                        required: true,
                        include: [{
                            model: UserDetail,
                            as: 'UserDetail',
                            required: true,
                            where: { branchId }
                        }]
                    }
                ],
                order: [['createdAt', 'DESC']]
            });

            if (rt === 'product_wise' || rt === 'item_wise' || rt === 'item' || rt === 'items_wise') {
                // Aggregate sales by product for this branch
                const productSales = {};
                orders.forEach(order => {
                    order.items.forEach(item => {
                        const pid = item.productId;
                        if (!productSales[pid]) {
                            productSales[pid] = {
                                productId: pid,
                                productName: item.product?.name || 'Unknown Product',
                                productSku: item.product?.sku || 'N/A',
                                totalQuantity: 0,
                                totalSales: 0
                            };
                        }
                        productSales[pid].totalQuantity += (item.quantity || 0);
                        productSales[pid].totalSales += (parseFloat(item.unitPrice || 0) * (item.quantity || 0));
                    });
                });
                return res.json(Object.values(productSales));
            }

            // Default or branch_wise: Return order details
            return res.json(orders);

        } else if (rs === 'payment' || rs === 'payments') {
            const payments = await Payment.findAll({
                where: dateFilter,
                include: [
                    {
                        model: Order,
                        as: 'order',
                        include: [{
                            model: OrderItem,
                            as: 'items',
                            include: [{ model: Product, as: 'product' }]
                        }]
                    },
                    {
                        model: User,
                        as: 'user',
                        required: true,
                        include: [{
                            model: UserDetail,
                            as: 'UserDetail',
                            required: true,
                            where: { branchId }
                        }]
                    }
                ],
                order: [['createdAt', 'DESC']]
            });

            if (rt === 'product_wise' || rt === 'item_wise' || rt === 'item' || rt === 'items_wise') {
                // Aggregate product sales based on payments received
                const productSales = {};
                payments.forEach(payment => {
                    if (payment.order && payment.order.items) {
                        payment.order.items.forEach(item => {
                            const pid = item.productId;
                            if (!productSales[pid]) {
                                productSales[pid] = {
                                    productId: pid,
                                    productName: item.product?.name || 'Unknown Product',
                                    productSku: item.product?.sku || 'N/A',
                                    totalQuantity: 0,
                                    totalSales: 0
                                };
                            }
                            productSales[pid].totalQuantity += (item.quantity || 0);
                            productSales[pid].totalSales += (parseFloat(item.unitPrice || 0) * (item.quantity || 0));
                        });
                    }
                });
                return res.json(Object.values(productSales));
            }

            // Default or branch_wise: Return payment details
            return res.json(payments);
        } else {
            return res.status(400).json({ message: 'Invalid report source. Use "order" or "payment".' });
        }

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
