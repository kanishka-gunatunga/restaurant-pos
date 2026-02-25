const Modification = require('../models/Modification');
const ModificationItem = require('../models/ModificationItem');
const sequelize = require('../config/database');

exports.getAllModifications = async (req, res) => {
    try {
        const { status } = req.query;
        let where = { status: 'active' };

        if (status === 'inactive') {
            where = { status: 'inactive' };
        } else if (status === 'all') {
            where = {};
        }

        const modifications = await Modification.findAll({ where });
        res.status(200).json(modifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getModificationById = async (req, res) => {
    try {
        const { id } = req.params;
        const modification = await Modification.findByPk(id, {
            include: [{ model: ModificationItem, as: 'items' }]
        });
        if (!modification) {
            return res.status(404).json({ message: 'Modification not found' });
        }
        res.json(modification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createModification = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { title, items } = req.body;

        const modification = await Modification.create({ title }, { transaction: t });

        if (items && items.length > 0) {
            for (const item of items) {
                await ModificationItem.create({
                    ...item,
                    modificationId: modification.id
                }, { transaction: t });
            }
        }

        await t.commit();
        const createdModification = await Modification.findByPk(modification.id, {
            include: [{ model: ModificationItem, as: 'items' }]
        });
        res.status(201).json(createdModification);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.updateModification = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { title, items } = req.body;

        const [updated] = await Modification.update({ title }, { where: { id }, transaction: t });

        if (items) {
            // Simple sync: delete all and re-create
            await ModificationItem.destroy({ where: { modificationId: id }, transaction: t });
            for (const item of items) {
                await ModificationItem.create({
                    ...item,
                    modificationId: id
                }, { transaction: t });
            }
        }

        await t.commit();
        const updatedModification = await Modification.findByPk(id, {
            include: [{ model: ModificationItem, as: 'items' }]
        });

        if (updatedModification) {
            return res.status(200).json(updatedModification);
        }
        res.status(404).json({ message: 'Modification not found' });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ message: error.message });
    }
};

exports.deactivateModification = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Modification.update({ status: 'inactive' }, { where: { id } });
        if (updated) {
            return res.status(200).json({ message: 'Modification deactivated' });
        }
        res.status(404).json({ message: 'Modification not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.activateModification = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Modification.update({ status: 'active' }, { where: { id } });
        if (updated) {
            return res.status(200).json({ message: 'Modification activated' });
        }
        res.status(404).json({ message: 'Modification not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
