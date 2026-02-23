const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ModificationItem = sequelize.define('ModificationItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    modificationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Modifications',
            key: 'id',
        },
    },
});

module.exports = ModificationItem;
