const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductBundle = sequelize.define('ProductBundle', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
    },
}, {
    tableName: 'product_bundles',
});

module.exports = ProductBundle;
