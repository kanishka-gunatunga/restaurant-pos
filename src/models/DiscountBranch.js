const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DiscountBranch = sequelize.define('DiscountBranch', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    discountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'discounts',
            key: 'id',
        },
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'branches', // Requires Branch model
            key: 'id',
        },
    },
}, {
    tableName: 'discountbranches',
});

module.exports = DiscountBranch;
