const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    paymentMethod: {
        type: DataTypes.ENUM('cash', 'card'),
        allowNull: false,
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    transactionId: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('pending', 'paid', 'refund', 'partial_refund'),
        defaultValue: 'pending',
    },
    paymentRole: {
        type: DataTypes.ENUM('sale', 'balance_due'),
        defaultValue: 'sale',
    },
    refundedAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    paidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
    },
}, {
    tableName: 'payments',
    underscored: true,
    timestamps: true,
});

module.exports = Payment;
