const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PrintJob = sequelize.define('PrintJob', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    order_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'order_id'
    },
    payment_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'payment_id'
    },
    printer_name: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'printer_name'
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
        type: DataTypes.ENUM('receipt', 'kitchen', 'sales_report'),
        defaultValue: 'receipt',
    },
    createdAt: {
        type: DataTypes.DATE,
        field: 'created_at'
    },
    updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at'
    }
}, {
    tableName: 'print_jobs',
    underscored: true,
    timestamps: true
});

module.exports = PrintJob;
