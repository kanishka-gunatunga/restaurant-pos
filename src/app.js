const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const sequelize = require('./config/database');
require('dotenv').config();

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
const cronRoutes = require('./routes/cronRoutes');
const { validatePositiveInt } = require('./middleware/validate');
const printRoutes = require('./routes/printRoutes');
const deliveryChargeRoutes = require('./routes/deliveryChargeRoutes');
const productBundleRoutes = require('./routes/productBundleRoutes');

const app = express();

app.param('id', (req, res, next, id) => {
    const err = validatePositiveInt(id, 'id');
    if (err) return res.status(400).json({ message: err });
    next();
});

const isProd = process.env.NODE_ENV === 'production';
const corsConfig = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

function corsOrigin(origin, cb) {
    if (!origin) return cb(null, true);
    for (const allowed of corsConfig) {
        if (allowed.startsWith('*.')) {
            const suffix = allowed.slice(2);
            try {
                const host = new URL(origin).hostname;
                if (host === suffix || host.endsWith('.' + suffix)) return cb(null, true);
            } catch (_) { }
        } else if (origin === allowed) {
            return cb(null, true);
        }
    }
    return cb(null, false);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: isProd && corsConfig.length ? corsOrigin : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
}));
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
app.use('/api/cron', cronRoutes);
app.use('/api/print', printRoutes);
app.use('/api/delivery-charges', deliveryChargeRoutes);
app.use('/api/product-bundles', productBundleRoutes);

// Global error handler (do not log request body to avoid leaking tokens/passwords)
app.use((err, req, res, next) => {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    const sqlCode = err.parent?.code || err.original?.code;
    if (sqlCode === 'ER_TOO_MANY_USER_CONNECTIONS') {
        return res.status(503).json({
            message:
                'Database connection limit reached for this user. Run a single server process if possible, and ask the DBA to free or raise max_user_connections.',
        });
    }
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
    });
});

const runAlterSync = ['1', 'true', 'yes'].includes(String(process.env.DB_SYNC_ALTER || '').toLowerCase());

sequelize
    .authenticate()
    .then(async () => {
        console.log('Database connection OK');
        if (!runAlterSync) {
            console.log('Skipping DB_SYNC_ALTER (set DB_SYNC_ALTER=true to run supply/order/payment schema alters)');
            return;
        }
        try {
            await sequelize.sync({ alter: true });
            console.log('Database schema alter sync finished (all models)');
        } catch (err) {
            console.error('Schema alter sync failed:', err);
        }
    })
    .catch((err) => {
        console.error('Database connection failed:', err);
        const code = err.parent?.code || err.original?.code;
        if (code === 'ER_TOO_MANY_USER_CONNECTIONS') {
            console.error(
                '\n>>> Fix: MySQL user has no free connection slots (shared across ALL clients).\n' +
                '    1) Disconnect MySQL Workbench (and any other tools using the same DB user).\n' +
                '    2) Task Manager: end every extra "Node.js" process for this project.\n' +
                '    3) Ask DBA: SHOW PROCESSLIST; KILL sleeping connections for this user, or raise\n' +
                '       max_user_connections (e.g. ALTER USER ... WITH MAX_USER_CONNECTIONS 20).\n'
            );
        }
    });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
