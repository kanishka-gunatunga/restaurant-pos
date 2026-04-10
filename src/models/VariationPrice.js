const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VariationPrice = sequelize.define('VariationPrice', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    variationOptionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    discountPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
    },
    expireDate: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    batchNo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    isUnlimited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    }
}, {
    tableName: 'variationprices',
});

module.exports = VariationPrice;
