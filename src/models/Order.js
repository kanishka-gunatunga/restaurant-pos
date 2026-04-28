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
    serviceCharge: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        field: 'service_charge'
    },
    deliveryChargeAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        field: 'delivery_charge_amount'
    },
    deliveryChargeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'delivery_charge_id',
        references: { model: 'delivery_charges', key: 'id' },
        onDelete: 'SET NULL',
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
    loyaltyPointsEarned: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'loyalty_points_earned'
    },
}, {
    tableName: 'orders',
});

module.exports = Order;
