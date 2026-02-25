const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Modification = sequelize.define('Modification', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
    },
});

module.exports = Modification;
