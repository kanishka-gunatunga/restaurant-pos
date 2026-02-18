const Payment = require('../models/Payment');
const Order = require('../models/Order');
const sequelize = require('../config/database');

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

        // Update order status if payment is successful
        // if (status === 'paid') {
        //     await order.update({ status: 'complete' }, { transaction: t });
        // }

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

        // const order = await Order.findByPk(payment.orderId);
        // if (order) {
        //     if (finalStatus === 'paid') {
        //         await order.update({ status: 'completed' }, { transaction: t });
        //     } else if (finalStatus === 'refund') {
        //         await order.update({ status: 'canceled' }, { transaction: t });
        //     }
        // }

        // await t.commit();
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
