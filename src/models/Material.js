const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Material = sequelize.define('Material', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    category: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'e.g. Meat, Dairy, Vegetables',
    },
    unit: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pieces',
        comment: 'kg, g, pieces, litres, etc.',
    },
    allBranches: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    minStockValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
    },
    minStockUnit: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'pieces',
    },
}, {
    tableName: 'materials',
    underscored: true,
    timestamps: true,
});

module.exports = Material;
