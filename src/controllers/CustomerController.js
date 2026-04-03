const Customer = require('../models/Customer');
const Order = require('../models/Order');
const MobitelSmsService = require('../services/MobitelSmsService');
const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');

exports.findOrCreate = async (req, res) => {
    try {
        let { mobile, name, address, email } = req.body;
        
        if (!name || name.trim() === '') {
            name = 'guest';
        }

        if (mobile && mobile.trim() === '') {
            mobile = null;
        }

        let customer = null;
        if (mobile) {
            customer = await Customer.findOne({ where: { mobile } });
            if (customer) {
                return res.json(customer);
            }
        }
        
        customer = await Customer.create({ mobile, name, address, email, status: 'active' });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Customer Created',
            description: `Customer ${name} ${mobile ? '(' + mobile + ')' : ''} created`.replace(/\s+/g, ' ').trim(),
            metadata: { customerId: customer.id, name, mobile }
        });

        res.status(201).json(customer);
    } catch (error) {
        console.error('Customers:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.createCustomer = async (req, res) => {
    try {
        let { mobile, name, address, email, promotions_enabled } = req.body;
        
        if (!name || name.trim() === '') {
            name = 'guest';
        }

        if (mobile && mobile.trim() === '') {
            mobile = null;
        }

        if (mobile) {
            const existing = await Customer.findOne({ where: { mobile } });
            if (existing) {
                return res.status(400).json({ message: 'Customer with this mobile already exists' });
            }
        }
        
        const customer = await Customer.create({
            mobile,
            name,
            address,
            email,
            status: 'active',
            promotions_enabled: promotions_enabled !== undefined ? promotions_enabled : true
        });

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Customer Created',
            description: `Customer ${name} ${mobile ? '(' + mobile + ')' : ''} created`.replace(/\s+/g, ' ').trim(),
            metadata: { customerId: customer.id, name, mobile }
        });

        res.status(201).json(customer);
    } catch (error) {
        console.error('Customers:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.getByMobile = async (req, res) => {
    try {
        const { mobile } = req.params;
        const customer = await Customer.findOne({ where: { mobile } });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        console.error('Customers:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.getAllCustomers = async (req, res) => {
    try {
        const { status } = req.query;
        let statusFilter = { status: 'active' };

        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const customers = await Customer.findAll({
            attributes: {
                include: [
                    [fn('COUNT', col('orders.id')), 'orders_count'],
                    [fn('MAX', col('orders.createdAt')), 'latest_order_date']
                ]
            },
            include: [
                {
                    model: Order,
                    as: 'orders',
                    attributes: []
                }
            ],
            where: statusFilter,
            group: ['Customer.id'],
            order: [['id', 'ASC']],
        });
        res.json(customers);
    } catch (error) {
        console.error('[GET /api/customers]', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.searchCustomers = async (req, res) => {
    try {
        const { query, status } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        let statusFilter = { status: 'active' };
        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const customers = await Customer.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: `%${query}%` } },
                    { mobile: { [Op.like]: `%${query}%` } },
                    { email: { [Op.like]: `%${query}%` } },
                    { address: { [Op.like]: `%${query}%` } }
                ],
                ...statusFilter
            },
            attributes: {
                include: [
                    [fn('COUNT', col('orders.id')), 'orders_count'],
                    [fn('MAX', col('orders.createdAt')), 'latest_order_date']
                ]
            },
            include: [
                {
                    model: Order,
                    as: 'orders',
                    attributes: []
                }
            ],
            group: ['Customer.id'],
            order: [['name', 'ASC']]
        });
        res.json(customers);
    } catch (error) {
        console.error('Customers:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;
        const customer = await Customer.findByPk(id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        console.error('Customers:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        let { name, mobile, address, email } = req.body;
        const customer = await Customer.findByPk(id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        
        if (name !== undefined) {
             customer.name = (!name || name.trim() === '') ? 'guest' : name;
        }
        if (mobile !== undefined) {
             customer.mobile = (mobile && mobile.trim() !== '') ? mobile : null;
        }
        if (address !== undefined) customer.address = address;
        if (email !== undefined) customer.email = email;
        await customer.save();

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Customer Updated',
            description: `Customer ${customer.name} ${customer.mobile ? '(' + customer.mobile + ')' : ''} updated`.replace(/\s+/g, ' ').trim(),
            metadata: { customerId: id, updatedFields: { name, mobile, address, email } }
        });

        res.json(customer);
    } catch (error) {
        console.error('[PUT /api/customers/:id]', error);
        res.status(400).json({ message: error.message });
    }
};

exports.updatePromotionPreference = async (req, res) => {
    try {
        const { id } = req.params;
        const { promotions_enabled } = req.body;
        if (promotions_enabled === undefined) {
            return res.status(400).json({ message: 'promotions_enabled field is required' });
        }
        const customer = await Customer.findByPk(id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        customer.promotions_enabled = promotions_enabled;
        await customer.save();
        res.json({
            message: `Promotions ${promotions_enabled ? 'enabled' : 'disabled'} successfully`,
            customer
        });
    } catch (error) {
        console.error('Customers:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.sendBulkPromotions = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Message content is required' });
        }
        const customers = await Customer.findAll({
            where: { 
                promotions_enabled: true,
                mobile: { [Op.not]: null }
            }
        });
        if (customers.length === 0) {
            return res.status(404).json({ message: 'No customers found with promotions enabled' });
        }
        const numbers = customers.map(c => {
            let num = c.mobile.replace(/\D/g, '');
            if (num.startsWith('0')) {
                num = '94' + num.slice(1);
            } else if (!num.startsWith('94')) {
                num = '94' + num;
            }
            return num;
        });
        const smsResponse = await MobitelSmsService.sendInstantSms(numbers, message);
        res.json({
            message: `Promotions sent to ${numbers.length} customers`,
            mobitel_response: smsResponse
        });
    } catch (error) {
        console.error('Customers:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.deactivateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Customer.update({ status: 'inactive' }, { where: { id } });
        if (updated) {
            return res.json({ message: 'Customer deactivated successfully' });
        }
        res.status(404).json({ message: 'Customer not found' });
    } catch (error) {
        console.error('Customers:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.activateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Customer.update({ status: 'active' }, { where: { id } });
        if (updated) {
            return res.json({ message: 'Customer activated successfully' });
        }
        res.status(404).json({ message: 'Customer not found' });
    } catch (error) {
        console.error('Customers:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};
