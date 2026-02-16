const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const modificationRoutes = require('./routes/modificationRoutes');

const app = express();

// Model Associations
const User = require('./models/User');
const Product = require('./models/Product');
const Category = require('./models/Category');
const Order = require('./models/Order');
const Branch = require('./models/Branch');
const Variation = require('./models/Variation');
const VariationPrice = require('./models/VariationPrice');
const Modification = require('./models/Modification');
const ProductModification = require('./models/ProductModification');
const ProductModificationPrice = require('./models/ProductModificationPrice');

// Product - Category Association
Category.hasMany(Product, { foreignKey: 'categoryId' });
Product.belongsTo(Category, { foreignKey: 'categoryId' });

// Product - Variation Association
Product.hasMany(Variation, { foreignKey: 'productId', as: 'variations' });
Variation.belongsTo(Product, { foreignKey: 'productId' });

// Variation - VariationPrice Association
Variation.hasMany(VariationPrice, { foreignKey: 'variationId', as: 'prices' });
VariationPrice.belongsTo(Variation, { foreignKey: 'variationId' });
VariationPrice.belongsTo(Branch, { foreignKey: 'branchId' });

// Product - Modification (Many-to-Many via ProductModification)
Product.belongsToMany(Modification, { through: ProductModification, foreignKey: 'productId', as: 'modifications' });
Modification.belongsToMany(Product, { through: ProductModification, foreignKey: 'modificationId' });

// ProductModification - ProductModificationPrice Association
ProductModification.hasMany(ProductModificationPrice, { foreignKey: 'productModificationId', as: 'prices' });
ProductModificationPrice.belongsTo(ProductModification, { foreignKey: 'productModificationId' });
ProductModificationPrice.belongsTo(Branch, { foreignKey: 'branchId' });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/modifications', modificationRoutes);

// Database Sync
sequelize.sync().then(() => {
    console.log('Database connected and synced');
}).catch(err => {
    console.error('Database connection failed:', err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
