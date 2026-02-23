const Customer = require('../models/Customer');
const MobitelSmsService = require('../services/MobitelSmsService');
/**
 * Find customer by mobile, or create if not exists.
 * Used when placing orders - if mobile exists, fetch; if not, add to DB.
 */
exports.findOrCreate = async (req, res) => {
    try {
        const { mobile, name } = req.body;

        if (!mobile || !name) {
            return res.status(400).json({ message: 'Mobile and name are required' });
        }

        let customer = await Customer.findOne({ where: { mobile } });

        if (customer) {
            return res.json(customer);
        }

        customer = await Customer.create({ mobile, name });
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
        const customers = await Customer.findAll({
            order: [['id', 'ASC']],
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
        const { name, mobile } = req.body;

        const customer = await Customer.findByPk(id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        if (name !== undefined) customer.name = name;
        if (mobile !== undefined) customer.mobile = mobile;
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

        // Get all customers with promotions enabled
        const customers = await Customer.findAll({
            where: { promotions_enabled: true }
        });

        if (customers.length === 0) {
            return res.status(404).json({ message: 'No customers found with promotions enabled' });
        }

        // Format numbers: prefix with 94 and remove leading 0
        const numbers = customers.map(c => {
            let num = c.mobile.replace(/\D/g, ''); // Remove non-numeric
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


