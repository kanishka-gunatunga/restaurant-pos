const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductBundleBranch = sequelize.define('ProductBundleBranch', {
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
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'branches',
            key: 'id',
        },
    },
    original_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    customer_saves: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
}, {
    tableName: 'product_bundle_branches',
});

module.exports = ProductBundleBranch;
