const Branch = require('../models/Branch');

exports.getAllBranches = async (req, res) => {
    try {
        const branches = await Branch.findAll();
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
        const { name } = req.body;
        const branch = await Branch.create({ name });
        res.status(201).json(branch);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const [updated] = await Branch.update({ name }, { where: { id } });
        if (updated) {
            const updatedBranch = await Branch.findByPk(id);
            return res.json(updatedBranch);
        }
        throw new Error('Branch not found');
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Branch.destroy({ where: { id } });
        if (deleted) {
            return res.json({ message: 'Branch deleted' });
        }
        throw new Error('Branch not found');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
