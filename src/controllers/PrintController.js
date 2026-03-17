const PrintJob = require('../models/PrintJob');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Variation = require('../models/Variation');
const OrderItem = require('../models/OrderItem');
const OrderItemModification = require('../models/OrderItemModification');
const ModificationItem = require('../models/ModificationItem');
const Branch = require('../models/Branch');

exports.getPendingJobs = async (req, res) => {
    try {
        const jobs = await PrintJob.findAll({
            where: { status: 'pending' },
            order: [['createdAt', 'ASC']]
        });
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const job = await PrintJob.findByPk(id);
        if (!job) return res.status(404).json({ message: 'Print job not found' });

        await job.update({ status: status || 'completed' });
        res.json({ message: 'Print job updated', job });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createManualPrintJob = async (req, res) => {
    try {
        const { orderId, paymentId, type } = req.body;

        const order = await Order.findByPk(orderId, {
            include: [
                { model: Customer, as: 'customer' },
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

        if (!order) return res.status(404).json({ message: 'Order not found' });

        const payment = paymentId ? await Payment.findByPk(paymentId) : null;
        
        // Fetch branch info via associations if possible, or just use branch 1
        // (Assuming req.user has branchId if authenticated)
        const branchId = req.user?.UserDetail?.branchId || 1;
        const branch = await Branch.findByPk(branchId);

        const templateService = require('../services/templateService');
        const content = templateService.generateReceiptHtml(order, payment, branch);

        const job = await PrintJob.create({
            orderId,
            paymentId: paymentId || null,
            content,
            type: type || 'receipt',
            status: 'pending'
        });

        res.status(201).json(job);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
