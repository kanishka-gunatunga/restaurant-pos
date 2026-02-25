const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Session = require('../models/Session');
const SessionTransaction = require('../models/SessionTransaction');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

exports.createPayment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { orderId, paymentMethod, amount, transactionId, status } = req.body;

        if (!orderId || !paymentMethod || !amount) {
            return res.status(400).json({ message: 'Order ID, payment method, and amount are required' });
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const payment = await Payment.create({
            orderId,
            paymentMethod,
            amount,
            transactionId,
            status: status || 'pending',
            userId: req.user?.id
        }, { transaction: t });

        // if (status === 'paid') {
        //     await order.update({ status: 'complete' }, { transaction: t });
        // }

        // Session integration for cash payments
        if (paymentMethod === 'cash' && (status === 'paid' || !status)) {
            const session = await Session.findOne({
                where: {
                    userId: req.user?.id,
                    status: 'open'
                }
            });

            if (session) {
                const amountFloat = parseFloat(amount);
                await session.update({
                    currentBalance: parseFloat(session.currentBalance) + amountFloat
                }, { transaction: t });

                await SessionTransaction.create({
                    sessionId: session.id,
                    type: 'sale',
                    amount: amountFloat,
                    paymentId: payment.id,
                    userId: req.user?.id,
                    description: `Cash sale for Order #${orderId}`
                }, { transaction: t });
            }
        }

        await t.commit();
        res.status(201).json(payment);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: error.message });
    }
};

exports.updatePaymentStatus = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { status, is_refund } = req.body;

        const payment = await Payment.findByPk(id);
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        let finalStatus = payment.status;
        if (is_refund == 1) {
            finalStatus = 'refund';
        } else if (status) {
            finalStatus = status;
        }

        await payment.update({ status: finalStatus }, { transaction: t });

        // if (order) {
        //     if (finalStatus === 'paid') {
        //         await order.update({ status: 'completed' }, { transaction: t });
        //     } else if (finalStatus === 'refund') {
        //         await order.update({ status: 'canceled' }, { transaction: t });
        //     }
        // }

        // Session integration for cash refunds
        if (payment.paymentMethod === 'cash' && finalStatus === 'refund') {
            const session = await Session.findOne({
                where: {
                    userId: req.user?.id,
                    status: 'open'
                }
            });

            if (session) {
                const amountFloat = parseFloat(payment.amount);
                await session.update({
                    currentBalance: parseFloat(session.currentBalance) - amountFloat
                }, { transaction: t });

                await SessionTransaction.create({
                    sessionId: session.id,
                    type: 'refund',
                    amount: amountFloat,
                    paymentId: payment.id,
                    userId: req.user?.id,
                    description: `Refund for Payment #${payment.id} (Order #${payment.orderId})`
                }, { transaction: t });
            }
        }

        await t.commit();
        res.json({ message: 'Payment status updated', payment });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: error.message });
    }
};

exports.getPaymentsByOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const payments = await Payment.findAll({ where: { orderId } });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllPaymentDetails = async (req, res) => {
    try {
        const orders = await Order.findAll({
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['paymentMethod', 'status']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map(order => {
            const validPayment = order.payments && order.payments.length > 0
                ? (order.payments.find(p => p.status !== 'refund') || order.payments[0])
                : null;

            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: validPayment ? validPayment.paymentMethod : null,
                paymentStatus: validPayment ? validPayment.status : 'Pending',
                amount: order.totalAmount
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.searchPaymentDetails = async (req, res) => {
    try {
        const { query } = req.query;
        let where = {};

        if (query) {
            where = {
                [Op.or]: [
                    { id: { [Op.like]: `%${query}%` } },
                    { '$customer.name$': { [Op.like]: `%${query}%` } },
                    { '$customer.mobile$': { [Op.like]: `%${query}%` } }
                ]
            };
        }

        const orders = await Order.findAll({
            where,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['paymentMethod', 'status']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map(order => {
            const validPayment = order.payments && order.payments.length > 0
                ? (order.payments.find(p => p.status !== 'refund') || order.payments[0])
                : null;

            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: validPayment ? validPayment.paymentMethod : null,
                paymentStatus: validPayment ? validPayment.status : 'Pending',
                amount: order.totalAmount
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.filterPaymentsByStatus = async (req, res) => {
    try {
        const { status } = req.query;

        const orders = await Order.findAll({
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name', 'mobile']
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['paymentMethod', 'status']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = orders.map(order => {
            const validPayment = order.payments && order.payments.length > 0
                ? (order.payments.find(p => p.status !== 'refund') || order.payments[0])
                : null;

            return {
                id: order.id,
                orderNo: order.id,
                customerName: order.customer ? order.customer.name : 'Walk-in',
                customerMobile: order.customer ? order.customer.mobile : '-',
                dateTime: order.createdAt,
                method: validPayment ? validPayment.paymentMethod : null,
                paymentStatus: validPayment ? validPayment.status : 'Pending',
                amount: order.totalAmount
            };
        });

        // Filter by status if provided
        let filteredResult = result;
        if (status) {
            filteredResult = result.filter(item =>
                item.paymentStatus.toLowerCase() === status.toLowerCase()
            );
        }

        res.json(filteredResult);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
