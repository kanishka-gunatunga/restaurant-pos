const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');
const VariationOption = require('../models/VariationOption');
const Return = require('../models/Return');
const ReturnItem = require('../models/ReturnItem');
const UserDetail = require('../models/UserDetail');
const PrintJob = require('../models/PrintJob');
const Branch = require('../models/Branch');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const templateService = require('../services/templateService');
const { logActivity } = require('./ActivityLogController');

exports.searchOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findByPk(id, {
            include: [
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { 
                            model: Product, 
                            as: 'product',
                            attributes: ['id', 'name', 'isReturnable']
                        },
                        { model: VariationOption, as: 'variationOption' }
                    ]
                },
                { model: Branch, as: 'branch' }
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

exports.createReturn = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { orderId, orderNo, items, refundMethod } = req.body;

        if (!items || items.length === 0) {
            throw new Error('No items provided for return');
        }

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        const branchId = userDetail?.branchId || 1;

        // Generate a unique QR code for store credit
        const qrCode = `RET-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        let totalAmount = 0;
        for (const item of items) {
            totalAmount += parseFloat(item.unitPrice) * parseInt(item.quantity);
        }

        const newReturn = await Return.create({
            orderId,
            orderNo,
            refundMethod: refundMethod || 'store_credit',
            totalAmount,
            qrCode,
            userId: req.user.id,
            branchId,
            status: 'active'
        }, { transaction: t });

        for (const item of items) {
            await ReturnItem.create({
                returnId: newReturn.id,
                productId: item.productId,
                variationOptionId: item.variationOptionId,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            }, { transaction: t });
        }

        await t.commit();

        // Fetch full return for printing
        const fullReturn = await Return.findByPk(newReturn.id, {
            include: [
                {
                    model: ReturnItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: VariationOption, as: 'variationOption' }
                    ]
                },
                { model: Branch, as: 'branch' }
            ]
        });

        // Queue Print Job
        try {
            const branch = fullReturn.branch;
            const data = templateService.generateReturnStructuredData(fullReturn, branch);
            await PrintJob.create({
                printer_name: 'XP-80',
                content: JSON.stringify(data),
                type: 'receipt', // Using receipt type as it's a customer facing document
                status: 'pending'
            });
        } catch (printError) {
            console.error('Failed to queue return print job:', printError);
        }

        await logActivity({
            userId: req.user.id,
            branchId,
            activityType: 'Return Created',
            description: `Return ${newReturn.id} created for order ${orderNo}`,
            metadata: { returnId: newReturn.id, orderNo, totalAmount }
        });

        res.status(201).json(fullReturn);
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.getReturnById = async (req, res) => {
    try {
        const { id } = req.params;
        const ret = await Return.findByPk(id, {
            include: [
                {
                    model: ReturnItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        { model: VariationOption, as: 'variationOption' }
                    ]
                },
                { model: Branch, as: 'branch' }
            ]
        });

        if (!ret) {
            return res.status(404).json({ message: 'Return not found' });
        }

        res.json(ret);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
