const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VoucherTemplate = sequelize.define('VoucherTemplate', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    valueFormatted: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    imageUrl: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    validityLabel: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'redeemed'),
        defaultValue: 'active',
    },
}, {
    tableName: 'voucher_templates',
    timestamps: true,
});

module.exports = VoucherTemplate;
