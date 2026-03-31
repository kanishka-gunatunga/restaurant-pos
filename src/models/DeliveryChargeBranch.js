const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryChargeBranch = sequelize.define('DeliveryChargeBranch', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    deliveryChargeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'delivery_charges',
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
}, {
    tableName: 'delivery_charge_branches',
});

module.exports = DeliveryChargeBranch;
