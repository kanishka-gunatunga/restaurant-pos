const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Table = sequelize.define('Table', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    table_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('available', 'unavailable', 'reserved'),
        defaultValue: 'available',
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'branches',
            key: 'id'
        },
        field: 'branch_id'
    },
}, {
    tableName: 'tables',
    underscored: true,
    timestamps: true,
});

module.exports = Table;
