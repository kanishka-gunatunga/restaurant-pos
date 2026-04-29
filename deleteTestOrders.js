const Order = require('./src/models/Order');
const OrderItem = require('./src/models/OrderItem');
const OrderItemModification = require('./src/models/OrderItemModification');
const Payment = require('./src/models/Payment');
const PrintJob = require('./src/models/PrintJob');
const ActivityLog = require('./src/models/ActivityLog'); 

async function run() {
    const ids = [700,699,695,522,523,525,527,38,39,40,140,536];
    try {
        console.log("Deleting Payments...");
        await Payment.destroy({ where: { orderId: ids } });
        console.log("Deleting PrintJobs...");
        await PrintJob.destroy({ where: { order_id: ids } });
        
        try {
            console.log("Deleting ActivityLogs...");
            await ActivityLog.destroy({ where: { orderId: ids } });
        } catch(e) {
            console.log("ActivityLog delete error or not exist", e.message);
        }

        console.log("Finding OrderItems...");
        const items = await OrderItem.findAll({ where: { orderId: ids }});
        const itemIds = items.map(i => i.id);
        
        if (itemIds.length > 0) {
            console.log(`Deleting OrderItemModifications for ${itemIds.length} items...`);
            await OrderItemModification.destroy({ where: { orderItemId: itemIds }});
            console.log(`Deleting OrderItems...`);
            await OrderItem.destroy({ where: { orderId: ids } });
        }

        console.log("Deleting Orders...");
        const count = await Order.destroy({ where: { id: ids }});
        console.log(`Deleted ${count} orders successfully.`);
    } catch (err) {
        console.error("Error deleting orders:", err);
    }
    process.exit();
}

run();
