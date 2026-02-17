const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItemModification = sequelize.define('OrderItemModification', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    orderItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    modificationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
});

module.exports = OrderItemModification;
