const Branch = require('../models/Branch');

exports.getAllBranches = async (req, res) => {
    try {
        const { status } = req.query;
        let where = { status: 'active' };

        if (status === 'inactive') {
            where = { status: 'inactive' };
        } else if (status === 'all') {
            where = {};
        }

        const branches = await Branch.findAll({ where });
        res.json(branches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getBranchById = async (req, res) => {
    try {
        const { id } = req.params;
        const branch = await Branch.findByPk(id);
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }
        res.json(branch);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createBranch = async (req, res) => {
    try {
        const { name, location } = req.body;
        const branch = await Branch.create({ name, location });
        res.status(201).json(branch);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location } = req.body;
        const [updated] = await Branch.update({ name, location }, { where: { id } });
        if (updated) {
            const updatedBranch = await Branch.findByPk(id);
            return res.json(updatedBranch);
        }
        throw new Error('Branch not found');
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deactivateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Branch.update({ status: 'inactive' }, { where: { id } });
        if (updated) {
            return res.json({ message: 'Branch deactivated' });
        }
        throw new Error('Branch not found');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.activateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Branch.update({ status: 'active' }, { where: { id } });
        if (updated) {
            return res.json({ message: 'Branch activated' });
        }
        throw new Error('Branch not found');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
