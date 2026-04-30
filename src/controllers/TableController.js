const { Table } = require('../models/associations');
const { Op } = require('sequelize');

exports.getTables = async (req, res) => {
    try {
        const { search } = req.query;
        let where = {};
        
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
        const { table_name, status } = req.body;
        
        if (!table_name) {
            return res.status(400).json({ message: 'Table name is required' });
        }

        const table = await Table.create({
            table_name,
            status: status || 'available'
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
        const { table_name, status } = req.body;

        const table = await Table.findByPk(id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }

        await table.update({
            table_name: table_name !== undefined ? table_name : table.table_name,
            status: status !== undefined ? status : table.status
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

        await table.destroy();
        res.json({ message: 'Table deleted successfully' });
    } catch (error) {
        console.error('Error deleting table:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
