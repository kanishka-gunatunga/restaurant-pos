const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    variationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    productDiscount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed'),
        defaultValue: 'pending',
    },
});

module.exports = OrderItem;
