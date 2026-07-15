const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IssuedVoucher = sequelize.define('IssuedVoucher', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'orders',
            key: 'id'
        }
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    barcode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    validityLabel: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    expiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    issuedToName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    issuedToPhone: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    branchName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'redeemed'),
        defaultValue: 'active',
    },
}, {
    tableName: 'issued_vouchers',
    timestamps: true,
});

module.exports = IssuedVoucher;
