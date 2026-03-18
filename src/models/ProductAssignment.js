const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductAssignment = sequelize.define('ProductAssignment', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'branches', key: 'id' },
        onDelete: 'CASCADE',
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'products', key: 'id' },
        onDelete: 'SET NULL',
    },
    productName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Display name; may mirror product.name when productId is set',
    },
    batchNo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    expiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    quantity: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
    },
    quantityUnit: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'items',
    },
    materialsUsed: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of { materialId, materialName?, qtyValue, qtyUnit }',
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'product_assignments',
    underscored: true,
    timestamps: true,
});

module.exports = ProductAssignment;
