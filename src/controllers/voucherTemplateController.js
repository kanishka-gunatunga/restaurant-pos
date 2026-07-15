const { Op } = require('sequelize');
const VoucherTemplate = require('../models/VoucherTemplate');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');

exports.getAllTemplates = async (req, res) => {
    try {
        const templates = await VoucherTemplate.findAll({
            order: [['createdAt', 'DESC']],
        });
        return res.json(templates);
    } catch (error) {
        console.error('Error fetching voucher templates:', error);
        return res.status(500).json({ message: error.message });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const { id, value, imageUrl, validityLabel, status } = req.body;
        
        const template = await VoucherTemplate.create({
            id: id || require('crypto').randomUUID(),
            value,
            imageUrl: imageUrl || '/product-placeholder.svg',
            validityLabel,
            status: status || 'active'
        });

        if (req.user && req.user.id) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Voucher Template Created',
                description: `Voucher Template ${value} created`,
                metadata: { templateId: template.id }
            });
        }

        return res.status(201).json(template);
    } catch (error) {
        console.error('Error creating voucher template:', error);
        return res.status(500).json({ message: error.message });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { value, imageUrl, validityLabel, status } = req.body;
        
        const template = await VoucherTemplate.findByPk(id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        await template.update({
            value: value !== undefined ? value : template.value,
            imageUrl: imageUrl !== undefined ? imageUrl : template.imageUrl,
            validityLabel: validityLabel !== undefined ? validityLabel : template.validityLabel,
            status: status !== undefined ? status : template.status
        });

        if (req.user && req.user.id) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Voucher Template Updated',
                description: `Voucher Template ${template.value} updated`,
                metadata: { templateId: id }
            });
        }

        return res.json(template);
    } catch (error) {
        console.error('Error updating voucher template:', error);
        return res.status(500).json({ message: error.message });
    }
};

exports.updateTemplateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['active', 'inactive', 'redeemed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const template = await VoucherTemplate.findByPk(id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        await template.update({ status });
        
        if (req.user && req.user.id) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            await logActivity({
                userId: req.user.id,
                branchId: userDetail?.branchId || 1,
                activityType: 'Voucher Template Status Changed',
                description: `Voucher Template ${template.value} status set to ${status}`,
                metadata: { templateId: id, status }
            });
        }
        
        return res.json(template);
    } catch (error) {
        console.error('Error updating voucher template status:', error);
        return res.status(500).json({ message: error.message });
    }
};
