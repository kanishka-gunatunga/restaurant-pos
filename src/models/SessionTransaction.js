const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SessionTransaction = sequelize.define('SessionTransaction', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    type: {
        type: DataTypes.ENUM('add', 'remove', 'sale', 'refund'),
        allowNull: false,
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    paymentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Reference to payment if type is sale or refund',
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'User who performed the transaction',
    },
}, {
    tableName: 'session_transactions',
    underscored: true,
    timestamps: true,
});

module.exports = SessionTransaction;
