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
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
});

module.exports = Modification;
