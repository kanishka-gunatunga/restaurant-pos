const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductModificationItemPrice = sequelize.define('ProductModificationItemPrice', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    productModificationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    modificationItemId: {
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
    },
}, {
    tableName: 'productmodificationitemprices',
});

module.exports = ProductModificationItemPrice;
