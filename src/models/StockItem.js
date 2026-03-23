const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockItem = sequelize.define('StockItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    materialId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'materials', key: 'id' },
        onDelete: 'CASCADE',
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'suppliers', key: 'id' },
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'branches', key: 'id' },
        onDelete: 'CASCADE',
    },
    batchNo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    expiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    quantityValue: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
    },
    quantityUnit: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'pieces',
    },
    status: {
        type: DataTypes.ENUM('available', 'low', 'out', 'expired'),
        defaultValue: 'available',
        comment: 'Derived from quantity and expiry; can be recomputed',
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'stock_items',
    underscored: true,
    timestamps: true,
});

module.exports = StockItem;
