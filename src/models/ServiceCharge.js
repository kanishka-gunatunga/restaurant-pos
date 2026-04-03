const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ServiceCharge = sequelize.define('ServiceCharge', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
}, {
    tableName: 'service_charges',
    timestamps: true,
    underscored: true,
});

module.exports = ServiceCharge;
