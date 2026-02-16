const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserDetail = sequelize.define('UserDetail', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    employeeId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Placeholder for future branch table - default 1 for now',
    },
}, {
    tableName: 'user_details',
    underscored: true,
    timestamps: true,
});

module.exports = UserDetail;
