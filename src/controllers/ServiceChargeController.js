const ServiceCharge = require('../models/ServiceCharge');

exports.getServiceCharge = async (req, res) => {
    try {
        let serviceCharge = await ServiceCharge.findOne();
        if (!serviceCharge) {
            // Default 0% service charge if not found
            serviceCharge = { percentage: '0.00' };
        }
        res.json(serviceCharge);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateServiceCharge = async (req, res) => {
    const { percentage } = req.body;

    if (percentage === undefined || isNaN(percentage)) {
        return res.status(400).json({ message: 'Invalid percentage value' });
    }

    try {
        let serviceCharge = await ServiceCharge.findOne();
        if (serviceCharge) {
            serviceCharge.percentage = percentage;
            await serviceCharge.save();
        } else {
            serviceCharge = await ServiceCharge.create({ percentage });
        }
        res.json(serviceCharge);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
