const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BogoPromotionBranch = sequelize.define('BogoPromotionBranch', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    bogoPromotionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bogo_promotions',
            key: 'id',
        },
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'branches',
            key: 'id',
        },
    },
}, {
    tableName: 'bogo_promotion_branches',
});

module.exports = BogoPromotionBranch;
