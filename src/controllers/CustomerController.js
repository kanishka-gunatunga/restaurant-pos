const Customer = require('../models/Customer');
const Order = require('../models/Order');
const MobitelSmsService = require('../services/MobitelSmsService');
const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');

exports.findOrCreate = async (req, res) => {
    try {
        const { mobile, name, address, email } = req.body;
        if (!mobile || !name) {
            return res.status(400).json({ message: 'Mobile and name are required' });
        }
        let customer = await Customer.findOne({ where: { mobile } });
        if (customer) {
            return res.json(customer);
        }
        customer = await Customer.create({ mobile, name, address, email, status: 'active' });
        res.status(201).json(customer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createCustomer = async (req, res) => {
    try {
        const { mobile, name, address, email, promotions_enabled } = req.body;
        if (!mobile || !name) {
            return res.status(400).json({ message: 'Mobile and name are required' });
        }
        const existing = await Customer.findOne({ where: { mobile } });
        if (existing) {
            return res.status(400).json({ message: 'Customer with this mobile already exists' });
        }
        const customer = await Customer.create({
            mobile,
            name,
            address,
            email,
            status: 'active',
            promotions_enabled: promotions_enabled !== undefined ? promotions_enabled : true
        });
        res.status(201).json(customer);
    } catch (error) {
        res.status(500).json({ message: error.message });
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
        res.status(500).json({ message: error.message });
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
        res.status(500).json({ message: error.message });
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
        res.status(500).json({ message: error.message });
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
        res.status(500).json({ message: error.message });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mobile, address, email } = req.body;
        const customer = await Customer.findByPk(id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        if (name !== undefined) customer.name = name;
        if (mobile !== undefined) customer.mobile = mobile;
        if (address !== undefined) customer.address = address;
        if (email !== undefined) customer.email = email;
        await customer.save();
        res.json(customer);
    } catch (error) {
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
        res.status(500).json({ message: error.message });
    }
};

exports.sendBulkPromotions = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Message content is required' });
        }
        const customers = await Customer.findAll({
            where: { promotions_enabled: true }
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
        res.status(500).json({ message: error.message });
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
        res.status(500).json({ message: error.message });
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
        res.status(500).json({ message: error.message });
    }
};
