const Order = require('./src/models/Order');
const OrderItem = require('./src/models/OrderItem');
const OrderItemModification = require('./src/models/OrderItemModification');
const Product = require('./src/models/Product');
const Variation = require('./src/models/Variation');
const VariationOption = require('./src/models/VariationOption');
const ModificationItem = require('./src/models/ModificationItem');
const Branch = require('./src/models/Branch');
const PrintJob = require('./src/models/PrintJob');
const Payment = require('./src/models/Payment');
const Customer = require('./src/models/Customer');
const User = require('./src/models/User');
const templateService = require('./src/services/templateService');
require('./src/models/associations'); // Init associations

async function createTestJobs() {
    try {
        const orderId = 38;
        console.log(`Fetching order ${orderId}...`);
        
        const order = await Order.findByPk(orderId, {
            include: [
                { model: Customer, as: 'customer' },
                { model: User, as: 'user' },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Product, as: 'product' },
                        {
                            model: VariationOption,
                            as: 'variationOption',
                            include: [{ model: Variation, as: 'Variation' }]
                        },
                        {
                            model: OrderItemModification,
                            as: 'modifications',
                            include: [{ model: ModificationItem, as: 'modification' }]
                        }
                    ]
                }
            ]
        });

        if (!order) {
            console.error('Order 38 not found!');
            process.exit(1);
        }

        const branch = await Branch.findByPk(order.branchId || 1);
        const payments = await Payment.findAll({ where: { orderId } });
        const primaryPayment = payments[0] || null;

        // 1. Create Kitchen Print Job
        const kitchenData = templateService.generateKitchenStructuredData(order, branch);
        const kitchenContent = JSON.stringify(kitchenData);
        const kitchenJob = await PrintJob.create({
            order_id: orderId,
            printer_name: 'XP-80',
            content: kitchenContent,
            type: 'kitchen',
            status: 'pending'
        });
        console.log(`Kitchen PrintJob (ID: ${kitchenJob.id}) created.`);

        // 2. Create Payment Print Job
        const receiptData = templateService.generateReceiptStructuredData(order, primaryPayment, branch);
        const receiptContent = JSON.stringify(receiptData);
        const receiptJob = await PrintJob.create({
            order_id: orderId,
            printer_name: 'XP-80',
            content: receiptContent,
            type: 'receipt',
            status: 'pending'
        });
        console.log(`Receipt PrintJob (ID: ${receiptJob.id}) created.`);

        console.log('\nBoth test jobs created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error creating test jobs:', err);
        process.exit(1);
    }
}

createTestJobs();
