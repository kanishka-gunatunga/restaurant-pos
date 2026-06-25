const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Customer = sequelize.define('Customer', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    mobile: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'guest',
    },
    promotions_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
    },
    loyalty_points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'loyalty_points'
    },
    category: {
        type: DataTypes.ENUM('normal', 'staff', 'management'),
        defaultValue: 'normal',
    },
}, {
    tableName: 'customers',
    underscored: true,
    timestamps: true,
});

module.exports = Customer;
