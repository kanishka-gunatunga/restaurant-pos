const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MaterialBranch = sequelize.define('MaterialBranch', {
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
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'branches', key: 'id' },
        onDelete: 'CASCADE',
    },
}, {
    tableName: 'material_branches',
    underscored: true,
    timestamps: false,
    indexes: [{ unique: true, fields: ['material_id', 'branch_id'] }],
});

module.exports = MaterialBranch;
