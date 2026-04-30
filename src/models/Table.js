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
}, {
    tableName: 'tables',
    underscored: true,
    timestamps: true,
});

module.exports = Table;
