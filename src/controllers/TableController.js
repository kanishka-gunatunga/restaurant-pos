const { Table } = require('../models/associations');
const UserDetail = require('../models/UserDetail');
const { Op } = require('sequelize');

exports.getTables = async (req, res) => {
    try {
        const { search } = req.query;
        let where = {};
        
        if (req.user.role !== 'admin') {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            if (userDetail) {
                where.branchId = userDetail.branchId;
            }
        }

        if (search) {
            where.table_name = {
                [Op.like]: `%${search}%`
            };
        }

        const tables = await Table.findAll({
            where,
            order: [['table_name', 'ASC']]
        });
        
        res.json(tables);
    } catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.createTable = async (req, res) => {
    try {
        const { table_name, status, branch_id } = req.body;
        
        if (!table_name) {
            return res.status(400).json({ message: 'Table name is required' });
        }

        let assignedBranchId = branch_id;
        if (req.user.role !== 'admin' || !assignedBranchId) {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            if (userDetail) assignedBranchId = userDetail.branchId;
        }

        if (!assignedBranchId) {
            return res.status(400).json({ message: 'Branch ID is required' });
        }

        const table = await Table.create({
            table_name,
            status: status || 'available',
            branchId: assignedBranchId
        });
        
        res.status(201).json(table);
    } catch (error) {
        console.error('Error creating table:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updateTable = async (req, res) => {
    try {
        const { id } = req.params;
        const { table_name, status, branch_id } = req.body;

        const table = await Table.findByPk(id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }

        if (req.user.role !== 'admin') {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            if (!userDetail || table.branchId !== userDetail.branchId) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        await table.update({
            table_name: table_name !== undefined ? table_name : table.table_name,
            status: status !== undefined ? status : table.status,
            branchId: branch_id !== undefined ? branch_id : table.branchId
        });

        res.json(table);
    } catch (error) {
        console.error('Error updating table:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.deleteTable = async (req, res) => {
    try {
        const { id } = req.params;

        const table = await Table.findByPk(id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }

        if (req.user.role !== 'admin') {
            const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
            if (!userDetail || table.branchId !== userDetail.branchId) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        await table.destroy();
        res.json({ message: 'Table deleted successfully' });
    } catch (error) {
        console.error('Error deleting table:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
