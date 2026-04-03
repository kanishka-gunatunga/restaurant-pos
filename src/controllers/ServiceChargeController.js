const ServiceCharge = require('../models/ServiceCharge');

exports.getServiceCharge = async (req, res) => {
    try {
        const { branchId } = req.query;
        let where = { branchId: branchId || null };
        let serviceCharge = await ServiceCharge.findOne({ where });

        if (!serviceCharge && branchId) {
            // Fallback to global if branch-specific not found
            serviceCharge = await ServiceCharge.findOne({ where: { branchId: null } });
        }

        if (!serviceCharge) {
            // Default 0% service charge if not found
            serviceCharge = { percentage: '0.00' };
        }
        res.json(serviceCharge);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getBranchServiceCharge = async (req, res) => {
    try {
        const { branchId } = req.params;
        let serviceCharge = await ServiceCharge.findOne({ where: { branchId } });

        if (!serviceCharge) {
            // Fallback to global if branch-specific not found
            serviceCharge = await ServiceCharge.findOne({ where: { branchId: null } });
        }

        if (!serviceCharge) {
            serviceCharge = { percentage: '0.00' };
        }
        res.json(serviceCharge);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateServiceCharge = async (req, res) => {
    const { percentage, branchId } = req.body;
    const effectiveBranchId = branchId || null;

    if (percentage === undefined || isNaN(percentage)) {
        return res.status(400).json({ message: 'Invalid percentage value' });
    }

    try {
        let serviceCharge = await ServiceCharge.findOne({ where: { branchId: effectiveBranchId } });
        if (serviceCharge) {
            serviceCharge.percentage = percentage;
            await serviceCharge.save();
        } else {
            serviceCharge = await ServiceCharge.create({ percentage, branchId: effectiveBranchId });
        }
        res.json(serviceCharge);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
