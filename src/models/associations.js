const User = require('./User');
const UserDetail = require('./UserDetail');
const Branch = require('./Branch');

// User <-> UserDetail: One-to-One
User.hasOne(UserDetail, { foreignKey: 'userId', as: 'UserDetail' });
UserDetail.belongsTo(User, { foreignKey: 'userId' });

// UserDetail <-> Branch: Many users can belong to one branch
UserDetail.belongsTo(Branch, { foreignKey: 'branchId' });
Branch.hasMany(UserDetail, { foreignKey: 'branchId' });
