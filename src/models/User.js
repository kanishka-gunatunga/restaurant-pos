const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    employeeId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: 'employee_id',
        field: 'employee_id',
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM('admin', 'manager', 'cashier', 'kitchen'),
        allowNull: false,
    },
    passcode: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'AES encrypted passcode - only for admin and manager roles',
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
