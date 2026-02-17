const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    orderType: {
        type: DataTypes.ENUM('takeaway', 'dining', 'delivery'),
        allowNull: false,
    },
    tableNumber: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    orderDiscount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    tax: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    orderNote: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    kitchenNote: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    orderTimer: {
        type: DataTypes.INTEGER, // Could be seconds or a timestamp depending on usage
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('pending', 'preparing', 'ready', 'reject', 'completed', 'canceled'),
        defaultValue: 'pending',
    },
    rejectReason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
});

module.exports = Order;
