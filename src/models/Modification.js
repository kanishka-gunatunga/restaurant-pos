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
});

module.exports = Modification;
