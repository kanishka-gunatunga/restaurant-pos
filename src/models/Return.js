const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Return = sequelize.define('Return', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'order_id'
    },
    orderNo: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'order_no'
    },
    refundMethod: {
        type: DataTypes.ENUM('store_credit'),
        defaultValue: 'store_credit',
        field: 'refund_method'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'total_amount'
    },
    qrCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'qr_code'
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id'
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'branch_id'
    },
    status: {
        type: DataTypes.ENUM('active', 'redeemed'),
        defaultValue: 'active'
    }
}, {
    tableName: 'returns',
    timestamps: true,
    underscored: true
});

module.exports = Return;
