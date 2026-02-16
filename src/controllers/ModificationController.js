const Modification = require('../models/Modification');

exports.getAllModifications = async (req, res) => {
    try {
        const modifications = await Modification.findAll();
        res.json(modifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getModificationById = async (req, res) => {
    try {
        const { id } = req.params;
        const modification = await Modification.findByPk(id);
        if (!modification) {
            return res.status(404).json({ message: 'Modification not found' });
        }
        res.json(modification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createModification = async (req, res) => {
    try {
        const modification = await Modification.create(req.body);
        res.status(201).json(modification);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateModification = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Modification.update(req.body, { where: { id } });
        if (updated) {
            const updatedModification = await Modification.findByPk(id);
            return res.status(200).json(updatedModification);
        }
        res.status(404).json({ message: 'Modification not found' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteModification = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Modification.destroy({ where: { id } });
        if (deleted) {
            return res.status(200).json({ message: 'Modification deleted' });
        }
        res.status(404).json({ message: 'Modification not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
