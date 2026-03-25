const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PrintJob = sequelize.define('PrintJob', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    paymentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    printerName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    content: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending',
    },
    type: {
        type: DataTypes.ENUM('receipt'),
        defaultValue: 'receipt',
    },
}, {
    tableName: 'print_jobs',
    underscored: true,
});

module.exports = PrintJob;
