const Customer = require('../models/Customer');

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

        let customer = await Customer.findByPk(mobile);

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
        const customer = await Customer.findByPk(mobile);

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
