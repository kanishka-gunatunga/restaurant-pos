const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductBundleItem = sequelize.define('ProductBundleItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    productBundleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'product_bundles',
            key: 'id',
        },
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'products',
            key: 'id',
        },
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
}, {
    tableName: 'product_bundle_items',
});

module.exports = ProductBundleItem;
