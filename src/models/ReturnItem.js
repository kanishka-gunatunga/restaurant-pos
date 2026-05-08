const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReturnItem = sequelize.define('ReturnItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    returnId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'return_id'
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'product_id'
    },
    variationOptionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'variation_option_id'
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'unit_price'
    }
}, {
    tableName: 'return_items',
    timestamps: true,
    underscored: true
});

module.exports = ReturnItem;
