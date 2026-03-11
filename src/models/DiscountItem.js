const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DiscountItem = sequelize.define('DiscountItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    discountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Discounts',
            key: 'id',
        },
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: true, // If null, applies to all selected branches or all branches
        references: {
            model: 'Branches',
            key: 'id',
        },
    },
    // Either productId OR variationOptionId must be set — enforced in controller
    productId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Products',
            key: 'id',
        },
    },
    variationOptionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'VariationOptions',
            key: 'id',
        },
    },
    discountType: {
        type: DataTypes.ENUM('percentage', 'fixed'),
        allowNull: false,
    },
    discountValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
}, {
    tableName: 'discountitems',
});

module.exports = DiscountItem;
