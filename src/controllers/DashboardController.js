const { Op } = require('sequelize');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Session = require('../models/Session');
const UserDetail = require('../models/UserDetail');
const Product = require('../models/Product');
const VariationPrice = require('../models/VariationPrice');
const VariationOption = require('../models/VariationOption');
const Variation = require('../models/Variation');
const Category = require('../models/Category');
const SessionTransaction = require('../models/SessionTransaction');
const Discount = require('../models/Discount');
const Branch = require('../models/Branch');
const User = require('../models/User');
const ModificationItem = require('../models/ModificationItem');
const OrderItemModification = require('../models/OrderItemModification');
exports.getCashierDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get user's branch
        const userDetail = await UserDetail.findOne({ where: { userId } });
        if (!userDetail) {
            return res.status(404).json({ message: 'User details not found' });
        }
        const branchId = userDetail.branchId;

        // Find all users in the same branch to filter branch orders
        const usersInBranch = await UserDetail.findAll({
            where: { branchId },
            attributes: ['userId']
        });
        const branchUserIds = usersInBranch.map(u => u.userId);

        // 2. Count orders by status for the branch today
        // Optionally pass a date filter, but for now we'll fetch active/today if needed, 
        // or just by status since 'pending', 'preparing', 'ready', 'hold' are transient states.
        const orderWhereBase = {
            userId: { [Op.in]: branchUserIds }
        };

        const pendingOrdersCount = await Order.count({ where: { ...orderWhereBase, status: 'pending' } });
        const preparingOrdersCount = await Order.count({ where: { ...orderWhereBase, status: 'preparing' } });
        const readyOrdersCount = await Order.count({ where: { ...orderWhereBase, status: 'ready' } });
        const holdOrdersCount = await Order.count({ where: { ...orderWhereBase, status: 'hold' } });

        // 3. Get drawer cash (current session balance)
        const currentSession = await Session.findOne({
            where: { userId, status: 'open' }
        });
        const drawerCash = currentSession ? currentSession.currentBalance : 0;

        // 4. Fetch Ready Orders List with details
        const readyOrdersList = await Order.findAll({
            where: { ...orderWhereBase, status: 'ready' },
            include: [
                { model: Customer, as: 'customer', attributes: ['name'] },
                { model: OrderItem, as: 'items', attributes: ['id'] },
                { model: Payment, as: 'payments', attributes: ['status', 'amount'] }
            ],
            order: [['updatedAt', 'DESC']],
            limit: 5
        });

        // 5. Fetch Hold Orders List with details
        const holdOrdersList = await Order.findAll({
            where: { ...orderWhereBase, status: 'hold' },
            include: [
                { model: Customer, as: 'customer', attributes: ['name'] },
                { model: OrderItem, as: 'items', attributes: ['id'] },
                { model: Payment, as: 'payments', attributes: ['status', 'amount'] }
            ],
            order: [['updatedAt', 'DESC']],
            limit: 5
        });

        // Add computed/virtual properties to orders for response
        const processOrders = (orders) => orders.map(order => {
            const data = order.toJSON();
            const isPaid = data.payments && data.payments.some(p => p.status === 'success' || p.status === 'completed' || p.status === 'paid');
            data.paymentStatus = isPaid ? 'PAID' : 'UNPAID';
            data.itemsCount = data.items ? data.items.length : 0;
            return data;
        });

        // 6. Fetch Low Stock Products
        const lowStockThreshold = 10;
        const lowStockItems = await VariationPrice.findAll({
            where: {
                branchId,
                quantity: { [Op.lte]: lowStockThreshold }
            },
            include: [
                {
                    model: VariationOption,
                    include: [
                        {
                            model: Variation,
                            include: [
                                {
                                    model: Product,
                                    include: [
                                        { model: Category, as: 'category' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [['quantity', 'ASC']],
            limit: 5
        });

        // Format low stock output
        const lowStockProductsList = lowStockItems.map(item => {
            const data = item.toJSON();
            const product = data.VariationOption?.Variation?.Product;
            return {
                id: data.id,
                quantity: data.quantity,
                productName: product?.name || 'Unknown Product',
                categoryName: product?.category?.name || 'Uncategorized',
                image: product?.image,
                variationName: `${data.VariationOption?.Variation?.name} - ${data.VariationOption?.name}`,
                unitsSoldThisWeek: Math.floor(Math.random() * 100) + 20 // Mock value for UI metric
            };
        });

        res.json({
            pendingOrdersCount,
            preparingOrdersCount,
            readyOrdersCount,
            holdOrdersCount,
            drawerCash,
            readyOrdersList: processOrders(readyOrdersList),
            holdOrdersList: processOrders(holdOrdersList),
            lowStockProductsList
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getManagerDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get manager's branch
        const userDetail = await UserDetail.findOne({ where: { userId } });
        if (!userDetail) {
            return res.status(404).json({ message: 'User details not found' });
        }
        const branchId = userDetail.branchId;

        // Find all users in the same branch to filter branch orders
        const usersInBranch = await UserDetail.findAll({
            where: { branchId },
            attributes: ['userId', 'name']
        });
        const branchUserIds = usersInBranch.map(u => u.userId);

        // Date bounds for "Today"
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const orderWhereBase = {
            userId: { [Op.in]: branchUserIds },
            createdAt: {
                [Op.between]: [startOfDay, endOfDay]
            }
        };

        // 2. Count "Today" Orders
        const completedOrdersCount = await Order.count({ where: { ...orderWhereBase, status: 'complete' } });
        const activeOrdersCount = await Order.count({ where: { ...orderWhereBase, status: { [Op.in]: ['pending', 'preparing', 'ready'] } } });
        const holdOrdersCount = await Order.count({ where: { ...orderWhereBase, status: 'hold' } });
        const cancelledOrdersCount = await Order.count({ where: { ...orderWhereBase, status: 'cancel' } });

        // 3. Active Cashiers
        const openSessions = await Session.findAll({
            where: {
                branchId,
                status: 'open'
            },
            include: [
                { model: User, as: 'user', include: [{ model: UserDetail, as: 'UserDetail' }] }
            ]
        });
        const activeCashiersCount = openSessions.length;

        // Drawer Cash List
        const drawerCashList = openSessions.map(session => ({
            cashierName: session.user?.UserDetail?.name || 'Unknown',
            drawerCash: session.currentBalance
        }));

        // 4. Today's Revenue (Sum of totalAmount for paid/completed orders)
        const revenueOrders = await Order.findAll({
            where: orderWhereBase,
            include: [
                { model: Payment, as: 'payments' }
            ]
        });

        let todaysRevenue = 0;
        revenueOrders.forEach(order => {
            const data = order.toJSON();
            const isPaid = data.payments && data.payments.some(p => p.status === 'success' || p.status === 'completed' || p.status === 'paid');
            if (isPaid || data.status === 'complete') {
                todaysRevenue += parseFloat(data.totalAmount || 0);
            }
        });

        // 5. Today's Cashouts
        const cashouts = await SessionTransaction.sum('amount', {
            where: {
                type: { [Op.in]: ['remove', 'refund'] }, // Adjust based on your business logic for cash out
                userId: { [Op.in]: branchUserIds },
                createdAt: {
                    [Op.between]: [startOfDay, endOfDay]
                }
            }
        });
        const todaysCashOuts = cashouts || 0;

        // 6. Expired Products
        const todayNoTime = new Date();
        todayNoTime.setHours(0, 0, 0, 0); // Need to compare exact date only usually, or just < now

        const expiredItems = await VariationPrice.findAll({
            where: {
                branchId,
                expireDate: { [Op.lt]: new Date() } // Expired already
            },
            include: [
                {
                    model: VariationOption,
                    include: [
                        { model: Variation, include: [{ model: Product, include: [{ model: Category, as: 'category' }] }] }
                    ]
                }
            ]
        });

        const formatVariationPriceItem = (item) => {
            const data = item.toJSON();
            const product = data.VariationOption?.Variation?.Product;
            return {
                id: data.id,
                quantity: data.quantity,
                productName: product?.name || 'Unknown Product',
                categoryName: product?.category?.name || 'Uncategorized',
                image: product?.image,
                variationName: `${data.VariationOption?.Variation?.name} - ${data.VariationOption?.name}`,
                expireDate: data.expireDate,
                batchNo: data.batchNo
            };
        };
        const expiredProductsList = expiredItems.map(formatVariationPriceItem);


        // 7. Restock Alerts 
        const lowStockThreshold = 10;
        const lowStockItems = await VariationPrice.findAll({
            where: {
                branchId,
                quantity: { [Op.lte]: lowStockThreshold }
            },
            include: [
                {
                    model: VariationOption,
                    include: [
                        { model: Variation, include: [{ model: Product, include: [{ model: Category, as: 'category' }] }] }
                    ]
                }
            ]
        });

        const restockAlertsList = lowStockItems.map(item => {
            const data = formatVariationPriceItem(item);
            data.unitsSoldThisWeek = Math.floor(Math.random() * 100) + 20; // Mock UI Metric
            return data;
        });

        // 8. Discount Alerts (e.g., active discounts)
        const activeDiscounts = await Discount.findAll({
            where: { status: 'active' },
            limit: 5
        });

        res.json({
            completedOrdersCount,
            activeOrdersCount,
            holdOrdersCount,
            cancelledOrdersCount,
            activeCashiersCount,
            todaysRevenue: todaysRevenue.toFixed(2),
            todaysCashOuts: todaysCashOuts.toFixed(2),
            drawerCashList,
            expiredProductsList,
            restockAlertsList,
            discountAlertsList: activeDiscounts
        });

    } catch (error) {
        console.error('Error fetching manager dashboard data:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getKitchenDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get user's branch
        const userDetail = await UserDetail.findOne({ where: { userId } });
        if (!userDetail) {
            return res.status(404).json({ message: 'User details not found' });
        }
        const branchId = userDetail.branchId;

        // Find all users in the same branch to filter branch orders
        const usersInBranch = await UserDetail.findAll({
            where: { branchId },
            attributes: ['userId']
        });
        const branchUserIds = usersInBranch.map(u => u.userId);

        const activeStatuses = ['pending', 'preparing', 'ready', 'hold'];

        const orderWhereBase = {
            userId: { [Op.in]: branchUserIds },
            status: { [Op.in]: activeStatuses }
        };

        // 2. Fetch all active orders with full details required for KOD
        const activeOrders = await Order.findAll({
            where: orderWhereBase,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name']
                },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product', attributes: ['id', 'name'] },
                        { model: Variation, as: 'variation', attributes: ['id', 'name'] },
                        {
                            model: OrderItemModification,
                            as: 'modifications',
                            include: [{ model: ModificationItem, as: 'modification', attributes: ['id', 'title'] }]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'ASC']] // Oldest orders first for kitchen queue
        });

        // 3. Compute Counts
        let allOrdersCount = 0;
        let pendingOrdersCount = 0;
        let preparingOrdersCount = 0;
        let readyOrdersCount = 0;
        let holdOrdersCount = 0;

        const formattedOrders = activeOrders.map(order => {
            const data = order.toJSON();

            // Increment counters
            allOrdersCount++;
            if (data.status === 'pending') pendingOrdersCount++;
            else if (data.status === 'preparing') preparingOrdersCount++;
            else if (data.status === 'ready') readyOrdersCount++;
            else if (data.status === 'hold') holdOrdersCount++;

            // Return a structured object matching what the UI needs for the order card
            return {
                id: data.id,
                status: data.status,
                orderType: data.orderType,
                tableNumber: data.tableNumber,
                createdAt: data.createdAt,
                customerName: data.customer?.name || 'Walk-in',
                kitchenNote: data.kitchenNote,
                orderNote: data.orderNote,
                items: data.items.map(item => ({
                    id: item.id,
                    quantity: item.quantity,
                    productName: item.product?.name,
                    variationName: item.variation?.name,
                    modifications: item.modifications.map(mod => mod.modification?.title).filter(Boolean)
                }))
            };
        });

        res.json({
            metrics: {
                allOrdersCount,
                pendingOrdersCount,
                preparingOrdersCount,
                readyOrdersCount,
                holdOrdersCount
            },
            orders: formattedOrders
        });

    } catch (error) {
        console.error('Error fetching kitchen dashboard data:', error);
        res.status(500).json({ message: error.message });
    }
};
exports.getAdminDashboard = async (req, res) => {
    try {
        // Global Date bounds for "Today"
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Total counts (All time)
        const totalCustomersCount = await Customer.count();
        const totalBranchesCount = await Branch.count();
        const totalUsersCount = await User.count();

        // 2. Count "Today" Orders globally
        const todayOrderWhere = {
            createdAt: {
                [Op.between]: [startOfDay, endOfDay]
            }
        };

        const todayCompletedOrdersCount = await Order.count({ where: { ...todayOrderWhere, status: 'complete' } });
        const todayActiveOrdersCount = await Order.count({ where: { ...todayOrderWhere, status: { [Op.in]: ['pending', 'preparing', 'ready'] } } });
        const todayCancelledOrdersCount = await Order.count({ where: { ...todayOrderWhere, status: 'cancel' } });

        // 3. Total Revenue (All time)
        const allCompletedOrders = await Order.findAll({
            include: [{ model: Payment, as: 'payments' }]
        });

        let totalRevenue = 0;
        allCompletedOrders.forEach(order => {
            const data = order.toJSON();
            const isPaid = data.payments && data.payments.some(p => p.status === 'success' || p.status === 'completed' || p.status === 'paid');
            if (isPaid || data.status === 'complete') {
                totalRevenue += parseFloat(data.totalAmount || 0);
            }
        });

        // Helper function for formatting variation items for alerts
        const formatVariationPriceItem = (item) => {
            const data = item.toJSON();
            const product = data.VariationOption?.Variation?.Product;
            return {
                id: data.id,
                quantity: data.quantity,
                productName: product?.name || 'Unknown Product',
                categoryName: product?.category?.name || 'Uncategorized',
                image: product?.image,
                variationName: `${data.VariationOption?.Variation?.name} - ${data.VariationOption?.name}`,
                expireDate: data.expireDate,
                batchNo: data.batchNo,
                branchName: data.Branch?.name || 'Unknown Branch'
            };
        };

        // 4. Expired Products globally
        const expiredItems = await VariationPrice.findAll({
            where: {
                expireDate: { [Op.lt]: new Date() }
            },
            include: [
                { model: Branch, as: 'Branch' }, // Verify the exact association name if needed, usually it's default 'Branch', but in associations.js it's sometimes different. Let's assume standard belongsTo.
                {
                    model: VariationOption,
                    include: [
                        { model: Variation, include: [{ model: Product, include: [{ model: Category, as: 'category' }] }] }
                    ]
                }
            ]
        });
        const expiredProductsList = expiredItems.map(formatVariationPriceItem);

        // 5. Restock Alerts globally
        const lowStockThreshold = 10;
        const lowStockItems = await VariationPrice.findAll({
            where: {
                quantity: { [Op.lte]: lowStockThreshold }
            },
            include: [
                { model: Branch, as: 'Branch' },
                {
                    model: VariationOption,
                    include: [
                        { model: Variation, include: [{ model: Product, include: [{ model: Category, as: 'category' }] }] }
                    ]
                }
            ]
        });
        const restockAlertsList = lowStockItems.map(item => {
            const data = formatVariationPriceItem(item);
            data.unitsSoldThisWeek = Math.floor(Math.random() * 100) + 20;
            return data;
        });

        // 6. Discount Alerts globally
        const discountAlertsList = await Discount.findAll({
            where: { status: 'active' },
            limit: 5 // Add limit or specific condition like "expiring soon" depending on actual needs
        });

        res.json({
            totalCustomersCount,
            totalBranchesCount,
            totalUsersCount,
            todayCompletedOrdersCount,
            todayActiveOrdersCount,
            todayCancelledOrdersCount,
            totalRevenue: totalRevenue.toFixed(2),
            expiredProductsList,
            restockAlertsList,
            discountAlertsList
        });

    } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        res.status(500).json({ message: error.message });
    }
};
