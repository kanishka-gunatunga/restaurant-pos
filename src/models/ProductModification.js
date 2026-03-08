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
    variationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    modificationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    tableName: 'productmodifications',
});

module.exports = ProductModification;
