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
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('pending', 'preparing', 'ready', 'hold', 'complete', 'cancel'),
        defaultValue: 'pending',
    },
    rejectReason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    deliveryAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    landmark: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    zipcode: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    deliveryInstructions: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'branch_id',
        references: { model: 'branches', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Branch where the order was placed; used to scope lists without relying on userId alone',
    },
    paymentStatus: {
        type: DataTypes.ENUM('pending', 'paid', 'partial_refund', 'refund'),
        defaultValue: 'pending',
    },
}, {
    tableName: 'orders',
});

module.exports = Order;
