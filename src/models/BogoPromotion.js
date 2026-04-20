const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BogoPromotion = sequelize.define('BogoPromotion', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    expiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    buyQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    getQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    buyProductId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'products',
            key: 'id',
        },
    },
    getProductId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'products',
            key: 'id',
        },
    },
    buyVariationOptionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'variationoptions',
            key: 'id',
        },
    },
    getVariationOptionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'variationoptions',
            key: 'id',
        },
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
    },
    image: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    tableName: 'bogo_promotions',
});

module.exports = BogoPromotion;
