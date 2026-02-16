const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM('admin', 'manager', 'cashier'),
        allowNull: false,
    },
    passcode: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Hashed passcode - only for admin and manager roles',
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
    },
}, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
});

module.exports = User;
