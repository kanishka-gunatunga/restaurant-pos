const bcrypt = require('bcryptjs');
const sequelize = require('./config/database');
const { encrypt } = require('./utils/crypto');

// Ensure all models are loaded via associations
require('./models/associations');

const {
    User, UserDetail, Branch, Category, Product,
    Variation, VariationOption, VariationPrice,
    Modification, ModificationItem, Customer,
    ProductBranch, Session, Order, OrderItem,
    Payment, SessionTransaction
} = sequelize.models;

async function seed() {
    try {
        console.log('Syncing database...');
        await sequelize.sync({ force: true });
        console.log('Database synced. All data cleared.');

        // 1. Branches
        const mainBranch = await Branch.create({ name: 'Main Branch', location: 'Downtown', contact: '1234567890' });
        const sideBranch = await Branch.create({ name: 'Side Branch', location: 'Uptown', contact: '0987654321' });

        // 2. Users (Passwords: password123)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        const adminUser = await User.create({ employeeId: 'EMP-001', password: hashedPassword, role: 'admin', passcode: encrypt('1111') });
        const managerUser = await User.create({ employeeId: 'EMP-002', password: hashedPassword, role: 'manager', passcode: encrypt('2222') });
        const cashierUser = await User.create({ employeeId: 'EMP-003', password: hashedPassword, role: 'cashier' });
        const kitchenUser = await User.create({ employeeId: 'EMP-004', password: hashedPassword, role: 'kitchen' });

        const adminEmployeeId = 'EMP-001';
        const managerEmployeeId = 'EMP-002';
        const cashierEmployeeId = 'EMP-003';
        const kitchenEmployeeId = 'EMP-004';

        // 3. UserDetails
        await UserDetail.bulkCreate([
            { userId: adminUser.id, name: 'Admin User', email: 'admin@test.com', branchId: mainBranch.id },
            { userId: managerUser.id, name: 'Manager User', email: 'manager@test.com', branchId: mainBranch.id },
            { userId: cashierUser.id, name: 'Cashier User', email: 'cashier@test.com', branchId: mainBranch.id },
            { userId: kitchenUser.id, name: 'Kitchen User', email: 'kitchen@test.com', branchId: sideBranch.id },
        ]);

        // 4. Categories
        const foodCategory = await Category.create({ name: 'Food', description: 'Delicious Food', isActive: true });
        const drinksCategory = await Category.create({ name: 'Drinks', description: 'Refreshing Drinks', isActive: true });

        // 5. Products
        const burger = await Product.create({
            name: 'Classic Burger', description: 'Beef burger',
            categoryId: foodCategory.id, code: 'PRD-001', sku: 'BURGER-01', isActive: true,
            // product shouldn't fail if price is missing, variations rule
        });

        const cola = await Product.create({
            name: 'Cola', description: 'Chilled Cola',
            categoryId: drinksCategory.id, code: 'PRD-002', sku: 'COLA-01', isActive: true,
        });

        await ProductBranch.bulkCreate([
            { productId: burger.id, branchId: mainBranch.id, isAvailable: true },
            { productId: cola.id, branchId: mainBranch.id, isAvailable: true }
        ]);

        // 6. Variations (e.g. Size)
        const sizeVar = await Variation.create({ name: 'Size', productId: burger.id });
        const regularOpt = await VariationOption.create({ name: 'Regular', variationId: sizeVar.id });
        const largeOpt = await VariationOption.create({ name: 'Large', variationId: sizeVar.id });

        await VariationPrice.bulkCreate([
            { variationOptionId: regularOpt.id, branchId: mainBranch.id, price: 10.00 },
            { variationOptionId: largeOpt.id, branchId: mainBranch.id, price: 15.00 }
        ]);

        // 7. Modifiers
        const addOn = await Modification.create({ title: 'Add-ons' });
        const cheese = await ModificationItem.create({ title: 'Extra Cheese', price: 1.50, modificationId: addOn.id });
        const bacon = await ModificationItem.create({ title: 'Bacon', price: 2.00, modificationId: addOn.id });

        // 8. Test Customer
        const customer = await Customer.create({ name: 'Joe Doe', mobile: '555-0192', email: 'joe@doe.com' });

        // 9. Session, Order, and Payments
        const session = await Session.create({
            userId: cashierUser.id,
            branchId: mainBranch.id,
            startBalance: 100.00,
            currentBalance: 125.00,
            status: 'open'
        });

        const order = await Order.create({
            customerId: customer.id,
            totalAmount: 25.00,
            orderType: 'dining',
            tableNumber: 'T1',
            status: 'complete',
            userId: cashierUser.id
        });

        await OrderItem.create({
            orderId: order.id,
            productId: burger.id,
            variationId: regularOpt.id,
            quantity: 2,
            unitPrice: 10.00,
            status: 'complete'
        });

        await OrderItem.create({
            orderId: order.id,
            productId: cola.id,
            quantity: 1,
            unitPrice: 5.00,
            status: 'complete'
        });

        const payment = await Payment.create({
            orderId: order.id,
            paymentMethod: 'cash',
            amount: 25.00,
            status: 'paid',
            userId: cashierUser.id
        });

        await SessionTransaction.create({
            sessionId: session.id,
            type: 'sale',
            amount: 25.00,
            description: `Payment for Order #${order.id}`,
            paymentId: payment.id,
            userId: cashierUser.id
        });

        console.log('\n=============================================');
        console.log('✅ TEST DATA INSERTED SUCCESSFULLY!');
        console.log('=============================================');
        console.log('🔑 Login Credentials:');
        console.log('---------------------------------------------');
        console.log(`[Admin]   Employee ID: ${adminEmployeeId} | Password: password123 | Passcode: 1111`);
        console.log(`[Manager] Employee ID: ${managerEmployeeId} | Password: password123 | Passcode: 2222`);
        console.log(`[Cashier] Employee ID: ${cashierEmployeeId} | Password: password123`);
        console.log(`[Kitchen] Employee ID: ${kitchenEmployeeId} | Password: password123`);
        console.log('=============================================\n');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seed();
