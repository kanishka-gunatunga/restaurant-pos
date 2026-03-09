const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductBranch = sequelize.define('ProductBranch', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    tableName: 'productbranches',
});

module.exports = ProductBranch;
