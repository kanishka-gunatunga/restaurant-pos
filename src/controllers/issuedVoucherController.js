const { Op } = require('sequelize');
const IssuedVoucher = require('../models/IssuedVoucher');
const Order = require('../models/Order');
const User = require('../models/User');
const UserDetail = require('../models/UserDetail');

exports.getAllIssuedVouchers = async (req, res) => {
    try {
        const vouchers = await IssuedVoucher.findAll({
            include: [{
                model: Order,
                as: 'order',
                attributes: ['id'],
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id'],
                    include: [{
                        model: UserDetail,
                        as: 'UserDetail',
                        attributes: ['name']
                    }]
                }]
            }],
            order: [['createdAt', 'DESC']],
        });

        // Basic summary
        let totalActiveCount = 0;
        let activeValue = 0;
        let redeemedCount = 0;
        let redeemedValue = 0;

        for (const v of vouchers) {
            const val = v.value || 0;
            if (v.status === 'active') {
                totalActiveCount++;
                activeValue += val;
            } else if (v.status === 'redeemed') {
                redeemedCount++;
                redeemedValue += val;
            }
        }

        const mappedVouchers = vouchers.map(v => {
            const vData = v.toJSON();
            vData.issuedByName = v.order?.user?.UserDetail?.name || null;
            delete vData.order;
            return vData;
        });

        return res.json({
            data: mappedVouchers,
            summary: {
                totalActiveCount,
                activeValueFormatted: `Rs.${activeValue.toFixed(2)}`,
                redeemedCount,
                redeemedValueFormatted: `Rs.${redeemedValue.toFixed(2)}`,
            }
        });
    } catch (error) {
        console.error('Error fetching issued vouchers:', error);
        return res.status(500).json({ message: error.message });
    }
};

exports.updateIssuedVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, validityLabel, expiryDate } = req.body;
        
        const voucher = await IssuedVoucher.findByPk(id);
        if (!voucher) {
            return res.status(404).json({ message: 'Issued voucher not found' });
        }

        const updates = {};
        if (status !== undefined) updates.status = status;
        if (validityLabel !== undefined) updates.validityLabel = validityLabel;
        if (expiryDate !== undefined) updates.expiryDate = expiryDate;

        await voucher.update(updates);

        return res.json(voucher);
    } catch (error) {
        console.error('Error updating issued voucher:', error);
        return res.status(500).json({ message: error.message });
    }
};

exports.updateIssuedVoucherStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['active', 'inactive', 'redeemed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const voucher = await IssuedVoucher.findByPk(id);
        if (!voucher) {
            return res.status(404).json({ message: 'Issued voucher not found' });
        }

        await voucher.update({ status });
        
        return res.json(voucher);
    } catch (error) {
        console.error('Error updating issued voucher status:', error);
        return res.status(500).json({ message: error.message });
    }
};

exports.validateVoucher = async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ message: 'Voucher code is required' });
        }

        const voucher = await IssuedVoucher.findOne({ 
            where: { 
                [Op.or]: [{ code }, { barcode: code }] 
            } 
        });

        if (!voucher) {
            return res.status(404).json({ message: 'Voucher not found' });
        }

        if (voucher.status !== 'active') {
            return res.status(400).json({ message: `Voucher is ${voucher.status}` });
        }

        // Check expiry date
        if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
            return res.status(400).json({ message: 'Voucher has expired' });
        }

        const value = voucher.value || 0;

        return res.json({
            id: voucher.id,
            code: voucher.code,
            amount: value,
            status: voucher.status
         });
    } catch (error) {
        console.error('Error validating voucher:', error);
        return res.status(500).json({ message: error.message });
    }
};
