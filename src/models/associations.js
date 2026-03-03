const User = require('./User');
const UserDetail = require('./UserDetail');
const Branch = require('./Branch');
const Order = require('./Order');
const Payment = require('./Payment');
const Session = require('./Session');
const SessionTransaction = require('./SessionTransaction');
const Customer = require('./Customer');
const OrderItem = require('./OrderItem');
const OrderItemModification = require('./OrderItemModification');
const Product = require('./Product');
const ProductBranch = require('./ProductBranch');
const Variation = require('./Variation');
const VariationOption = require('./VariationOption');
const ModificationItem = require('./ModificationItem');
const Category = require('./Category');
const VariationPrice = require('./VariationPrice');
const Modification = require('./Modification');
const ProductModification = require('./ProductModification');
const ProductModificationPrice = require('./ProductModificationPrice');
const ProductModificationItemPrice = require('./ProductModificationItemPrice');
const Discount = require('./Discount');
const DiscountItem = require('./DiscountItem');

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

// Order <-> Customer: Many orders can belong to one customer
Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Order, { foreignKey: 'customerId', as: 'orders' });

// Order - OrderItem Association
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE', hooks: true });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
OrderItem.belongsTo(Variation, { foreignKey: 'variationId', as: 'variation' });

// OrderItem - OrderItemModification Association
OrderItem.hasMany(OrderItemModification, { foreignKey: 'orderItemId', as: 'modifications', onDelete: 'CASCADE', hooks: true });
OrderItemModification.belongsTo(OrderItem, { foreignKey: 'orderItemId' });
OrderItemModification.belongsTo(ModificationItem, { foreignKey: 'modificationId', as: 'modification' });

// Order - Payment Association
Order.hasMany(Payment, { foreignKey: 'orderId', as: 'payments', onDelete: 'CASCADE', hooks: true });
Payment.belongsTo(Order, { foreignKey: 'orderId' });

// Product - Category Association (parentCategory)
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// Product - SubCategory Association
Category.hasMany(Product, { foreignKey: 'subCategoryId', as: 'subCategoryProducts' });
Product.belongsTo(Category, { foreignKey: 'subCategoryId', as: 'subCategory' });

// Product - Branch Availability
Product.hasMany(ProductBranch, { foreignKey: 'productId', as: 'branches', onDelete: 'CASCADE', hooks: true });
ProductBranch.belongsTo(Product, { foreignKey: 'productId' });
ProductBranch.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

// Product - Variation Association
Product.hasMany(Variation, { foreignKey: 'productId', as: 'variations', onDelete: 'CASCADE', hooks: true });
Variation.belongsTo(Product, { foreignKey: 'productId' });

// Variation - VariationOption Association
Variation.hasMany(VariationOption, { foreignKey: 'variationId', as: 'options', onDelete: 'CASCADE', hooks: true });
VariationOption.belongsTo(Variation, { foreignKey: 'variationId' });

// VariationOption - VariationPrice Association
VariationOption.hasMany(VariationPrice, { foreignKey: 'variationOptionId', as: 'prices', onDelete: 'CASCADE', hooks: true });
VariationPrice.belongsTo(VariationOption, { foreignKey: 'variationOptionId' });
VariationPrice.belongsTo(Branch, { foreignKey: 'branchId' });

// Product - Modification Many-to-Many
Product.belongsToMany(Modification, { through: ProductModification, foreignKey: 'productId', as: 'modifications' });
Modification.belongsToMany(Product, { through: ProductModification, foreignKey: 'modificationId' });

// Modification - ModificationItem Association
Modification.hasMany(ModificationItem, { foreignKey: 'modificationId', as: 'items', onDelete: 'CASCADE', hooks: true });
ModificationItem.belongsTo(Modification, { foreignKey: 'modificationId' });

// Explicit associations for the join table to allow nested includes
Product.hasMany(ProductModification, { foreignKey: 'productId', as: 'productModifications', onDelete: 'CASCADE', hooks: true });
ProductModification.belongsTo(Product, { foreignKey: 'productId' });

Variation.hasMany(ProductModification, { foreignKey: 'variationId', as: 'variationModifications', onDelete: 'CASCADE', hooks: true });
ProductModification.belongsTo(Variation, { foreignKey: 'variationId' });

Modification.hasMany(ProductModification, { foreignKey: 'modificationId', as: 'productModifications' });
ProductModification.belongsTo(Modification, { foreignKey: 'modificationId' });

// ProductModification - ProductModificationPrice Association (Legacy)
ProductModification.hasMany(ProductModificationPrice, { foreignKey: 'productModificationId', as: 'prices', onDelete: 'CASCADE', hooks: true });
ProductModificationPrice.belongsTo(ProductModification, { foreignKey: 'productModificationId' });
ProductModificationPrice.belongsTo(Branch, { foreignKey: 'branchId' });

// ProductModification - ProductModificationItemPrice Association (New)
ProductModification.hasMany(ProductModificationItemPrice, { foreignKey: 'productModificationId', as: 'itemPrices', onDelete: 'CASCADE', hooks: true });
ProductModificationItemPrice.belongsTo(ProductModification, { foreignKey: 'productModificationId' });
ProductModificationItemPrice.belongsTo(ModificationItem, { foreignKey: 'modificationItemId', as: 'item' });
ProductModificationItemPrice.belongsTo(Branch, { foreignKey: 'branchId' });

// Discount - DiscountItem Association
Discount.hasMany(DiscountItem, { foreignKey: 'discountId', as: 'items', onDelete: 'CASCADE', hooks: true });
DiscountItem.belongsTo(Discount, { foreignKey: 'discountId' });

// DiscountItem - Product Association
DiscountItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(DiscountItem, { foreignKey: 'productId', as: 'discountItems' });

// DiscountItem - VariationOption Association
DiscountItem.belongsTo(VariationOption, { foreignKey: 'variationOptionId', as: 'variationOption' });
VariationOption.hasMany(DiscountItem, { foreignKey: 'variationOptionId', as: 'discountItems' });
