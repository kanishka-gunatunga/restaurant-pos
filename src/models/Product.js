const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    image: {
        type: DataTypes.STRING,
    },
    shortDescription: {
        type: DataTypes.STRING,
    },
    description: {
        type: DataTypes.TEXT,
    },
    sku: {
        type: DataTypes.STRING,
        unique: true,
    },
    categoryId: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Categories',
            key: 'id',
        },
    },
});

module.exports = Product;
