const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id',
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'branch_id',
    },
    activityType: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'activity_type',
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'order_id',
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    managerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'manager_id',
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
    },
}, {
    tableName: 'activity_logs',
    underscored: true,
    timestamps: true,
});

module.exports = ActivityLog;
