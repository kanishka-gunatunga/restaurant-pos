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
const DiscountBranch = require('./DiscountBranch');
const ActivityLog = require('./ActivityLog');
const Supplier = require('./Supplier');
const Material = require('./Material');
const MaterialBranch = require('./MaterialBranch');
const StockItem = require('./StockItem');
const ProductAssignment = require('./ProductAssignment');
const PrintJob = require('./PrintJob');
const DeliveryCharge = require('./DeliveryCharge');
const DeliveryChargeBranch = require('./DeliveryChargeBranch');
const ProductBundle = require('./ProductBundle');
const ProductBundleBranch = require('./ProductBundleBranch');
const ProductBundleItem = require('./ProductBundleItem');
const ServiceCharge = require('./ServiceCharge');

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

// Order <-> Branch
Branch.hasMany(Order, { foreignKey: 'branchId', as: 'orders' });
Order.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

// Order <-> Customer: Many orders can belong to one customer
Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Order, { foreignKey: 'customerId', as: 'orders' });

// Order <-> DeliveryCharge
Order.belongsTo(DeliveryCharge, { foreignKey: 'deliveryChargeId', as: 'deliveryCharge' });
DeliveryCharge.hasMany(Order, { foreignKey: 'deliveryChargeId', as: 'orders' });

// Order - OrderItem Association
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE', hooks: true });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
OrderItem.belongsTo(VariationOption, { foreignKey: 'variationOptionId', as: 'variationOption' });

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

// Discount - DiscountBranch Association
Discount.hasMany(DiscountBranch, { foreignKey: 'discountId', as: 'branches', onDelete: 'CASCADE', hooks: true });
DiscountBranch.belongsTo(Discount, { foreignKey: 'discountId' });

// DiscountBranch - Branch Association
DiscountBranch.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
Branch.hasMany(DiscountBranch, { foreignKey: 'branchId' });

// Discount - DiscountItem Association
Discount.hasMany(DiscountItem, { foreignKey: 'discountId', as: 'items', onDelete: 'CASCADE', hooks: true });
DiscountItem.belongsTo(Discount, { foreignKey: 'discountId' });

// DiscountItem - Branch Association
DiscountItem.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
Branch.hasMany(DiscountItem, { foreignKey: 'branchId' });

// DiscountItem - Product Association
DiscountItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(DiscountItem, { foreignKey: 'productId', as: 'discountItems' });

// DiscountItem - VariationOption Association
DiscountItem.belongsTo(VariationOption, { foreignKey: 'variationOptionId', as: 'variationOption' });
VariationOption.hasMany(DiscountItem, { foreignKey: 'variationOptionId', as: 'discountItems' });

// ActivityLog Associations
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(ActivityLog, { foreignKey: 'userId' });

ActivityLog.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
Branch.hasMany(ActivityLog, { foreignKey: 'branchId' });

ActivityLog.belongsTo(User, { foreignKey: 'managerId', as: 'manager' });

ActivityLog.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Order.hasMany(ActivityLog, { foreignKey: 'orderId' });

// Supply: Branch <-> Supplier
Branch.hasMany(Supplier, { foreignKey: 'branchId', as: 'suppliers' });
Supplier.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

// Supply: Material <-> MaterialBranch <-> Branch (many-to-many when allBranches = false)
Material.hasMany(MaterialBranch, { foreignKey: 'materialId', as: 'materialBranches', onDelete: 'CASCADE', hooks: true });
MaterialBranch.belongsTo(Material, { foreignKey: 'materialId' });
MaterialBranch.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
Branch.hasMany(MaterialBranch, { foreignKey: 'branchId', as: 'materialBranches' });

// Supply: StockItem
Material.hasMany(StockItem, { foreignKey: 'materialId', as: 'stockItems', onDelete: 'CASCADE', hooks: true });
StockItem.belongsTo(Material, { foreignKey: 'materialId', as: 'material' });
Supplier.hasMany(StockItem, { foreignKey: 'supplierId', as: 'stockItems', onDelete: 'RESTRICT' });
StockItem.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplier' });
Branch.hasMany(StockItem, { foreignKey: 'branchId', as: 'stockItems', onDelete: 'CASCADE', hooks: true });
StockItem.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

// Supply: ProductAssignment
Branch.hasMany(ProductAssignment, { foreignKey: 'branchId', as: 'productAssignments', onDelete: 'CASCADE', hooks: true });
ProductAssignment.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
Product.hasMany(ProductAssignment, { foreignKey: 'productId', as: 'productAssignments', onDelete: 'SET NULL' });
ProductAssignment.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// PrintJob Associations
Order.hasMany(PrintJob, { foreignKey: 'order_id', as: 'printJobs' });
PrintJob.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Payment.hasMany(PrintJob, { foreignKey: 'payment_id', as: 'printJobs' });
PrintJob.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// DeliveryCharge - DeliveryChargeBranch Association
DeliveryCharge.hasMany(DeliveryChargeBranch, { foreignKey: 'deliveryChargeId', as: 'branches', onDelete: 'CASCADE', hooks: true });
DeliveryChargeBranch.belongsTo(DeliveryCharge, { foreignKey: 'deliveryChargeId' });

// DeliveryChargeBranch - Branch Association
DeliveryChargeBranch.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
Branch.hasMany(DeliveryChargeBranch, { foreignKey: 'branchId' });

// ProductBundle - ProductBundleBranch Association
ProductBundle.hasMany(ProductBundleBranch, { foreignKey: 'productBundleId', as: 'branches', onDelete: 'CASCADE', hooks: true });
ProductBundleBranch.belongsTo(ProductBundle, { foreignKey: 'productBundleId' });

// ProductBundleBranch - Branch Association
ProductBundleBranch.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
Branch.hasMany(ProductBundleBranch, { foreignKey: 'branchId', as: 'productBundles' });

// ProductBundle - ProductBundleItem Association
ProductBundle.hasMany(ProductBundleItem, { foreignKey: 'productBundleId', as: 'items', onDelete: 'CASCADE', hooks: true });
ProductBundleItem.belongsTo(ProductBundle, { foreignKey: 'productBundleId' });

// ProductBundleItem - Product Association
ProductBundleItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(ProductBundleItem, { foreignKey: 'productId' });

// ServiceCharge Associations
Branch.hasOne(ServiceCharge, { foreignKey: 'branchId', as: 'serviceCharge' });
ServiceCharge.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
