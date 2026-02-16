const User = require('./User');
const UserDetail = require('./UserDetail');

// User <-> UserDetail: One-to-One
User.hasOne(UserDetail, { foreignKey: 'userId', as: 'UserDetail' });
UserDetail.belongsTo(User, { foreignKey: 'userId' });
