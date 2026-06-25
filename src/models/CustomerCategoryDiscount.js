const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CustomerCategoryDiscount = sequelize.define('CustomerCategoryDiscount', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    category: {
        type: DataTypes.ENUM('normal', 'staff', 'management'),
        allowNull: false,
        unique: true,
    },
    discount_percentage: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 100
        }
    },
}, {
    tableName: 'customer_category_discounts',
    underscored: true,
    timestamps: true,
});

module.exports = CustomerCategoryDiscount;
