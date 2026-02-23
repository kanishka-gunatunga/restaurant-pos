const User = require('./User');
const UserDetail = require('./UserDetail');
const Branch = require('./Branch');
const Order = require('./Order');
const Payment = require('./Payment');
const Session = require('./Session');
const SessionTransaction = require('./SessionTransaction');

// User <-> UserDetail: One-to-One
User.hasOne(UserDetail, { foreignKey: 'userId', as: 'UserDetail' });
UserDetail.belongsTo(User, { foreignKey: 'userId' });

// UserDetail <-> Branch: Many users can belong to one branch
UserDetail.belongsTo(Branch, { foreignKey: 'branchId' });
Branch.hasMany(UserDetail, { foreignKey: 'branchId' });

// User <-> Order: One-to-Many
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User <-> Payment: One-to-Many
User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User <-> Session: One-to-Many
User.hasMany(Session, { foreignKey: 'userId', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Session.belongsTo(User, { foreignKey: 'closedBy', as: 'closedByUser' });

// Branch <-> Session: One-to-Many
Branch.hasMany(Session, { foreignKey: 'branchId', as: 'sessions' });
Session.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

// Session <-> SessionTransaction: One-to-Many
Session.hasMany(SessionTransaction, { foreignKey: 'sessionId', as: 'transactions', onDelete: 'CASCADE', hooks: true });
SessionTransaction.belongsTo(Session, { foreignKey: 'sessionId', as: 'session' });

// User <-> SessionTransaction: One-to-Many
User.hasMany(SessionTransaction, { foreignKey: 'userId', as: 'sessionTransactions' });
SessionTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Payment <-> SessionTransaction: One-to-One (optional)
Payment.hasOne(SessionTransaction, { foreignKey: 'paymentId', as: 'sessionTransaction' });
SessionTransaction.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });
