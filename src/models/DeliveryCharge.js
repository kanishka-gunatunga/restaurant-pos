const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryCharge = sequelize.define('DeliveryCharge', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
    },
}, {
    tableName: 'delivery_charges',
});

module.exports = DeliveryCharge;
