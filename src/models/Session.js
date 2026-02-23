const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Session = sequelize.define('Session', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    startBalance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    currentBalance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    status: {
        type: DataTypes.ENUM('open', 'closed'),
        defaultValue: 'open',
    },
    startTime: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    closedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Manager or admin ID who authorized closing the session',
    },
}, {
    tableName: 'sessions',
    underscored: true,
    timestamps: true,
});

module.exports = Session;
