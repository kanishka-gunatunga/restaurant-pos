const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const Supplier = require('./models/Supplier');
const Material = require('./models/Material');
const MaterialBranch = require('./models/MaterialBranch');
const StockItem = require('./models/StockItem');
const ProductAssignment = require('./models/ProductAssignment');
require('dotenv').config();

// Load model associations (must run after models are loaded)
require('./models/associations');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const customerRoutes = require('./routes/customerRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const modificationRoutes = require('./routes/modificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const branchRoutes = require('./routes/branchRoutes');
const discountRoutes = require('./routes/discountRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const materialRoutes = require('./routes/materialRoutes');
const stockRoutes = require('./routes/stockRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');

const app = express();


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/modifications', modificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/supply/stocks', stockRoutes);
app.use('/api/supply/assignments', assignmentRoutes);

// Global error handler (catches unhandled errors, e.g. JSON parse)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
    });
});

// Database Sync
sequelize.sync().then(async () => { 
    try {
        
        await Supplier.sync({ alter: true });
        await Material.sync({ alter: true });
        await MaterialBranch.sync({ alter: true });
        await StockItem.sync({ alter: true });
        await ProductAssignment.sync({ alter: true });
        console.log('Database connected and synced');
    } catch (err) {
        console.error('Supply table sync failed:', err);
    }
}).catch(err => {
    console.error('Database connection failed:', err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
