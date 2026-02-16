const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductModification = sequelize.define('ProductModification', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    modificationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
});

module.exports = ProductModification;
