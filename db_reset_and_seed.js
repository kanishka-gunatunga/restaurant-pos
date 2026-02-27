const sequelize = require('./src/config/database');
const bcrypt = require('bcryptjs');

const User = require('./src/models/User');
const UserDetail = require('./src/models/UserDetail');
const Branch = require('./src/models/Branch');
const Category = require('./src/models/Category');
const Product = require('./src/models/Product');
const ProductBranch = require('./src/models/ProductBranch');
const Variation = require('./src/models/Variation');
const VariationOption = require('./src/models/VariationOption');
const VariationPrice = require('./src/models/VariationPrice');
const Modification = require('./src/models/Modification');
const ModificationItem = require('./src/models/ModificationItem');
const ProductModification = require('./src/models/ProductModification');
const Customer = require('./src/models/Customer');
const Session = require('./src/models/Session');
const Order = require('./src/models/Order');
const OrderItem = require('./src/models/OrderItem');
const Payment = require('./src/models/Payment');

require('./src/models/associations');

async function resetAndSeed() {
    try {
        console.log('Force syncing database (dropping and recreating tables)...');
        await sequelize.sync({ force: true });
        console.log('Database synced successfully.');

        // 1. Create a Branch
        const branch = await Branch.create({
            name: 'Main Branch',
            location: 'Colombo',
            phone: '0112345678',
            status: 'active'
        });
        console.log('Created Branch:', branch.name);

        // 2. Create an Admin User
        const hashedPassword = await bcrypt.hash('password123', 10);
        const user = await User.create({
            employeeId: 'EMP001',
            password: hashedPassword,
            role: 'admin',
            passcode: '1234',
            status: 'active'
        });
        await UserDetail.create({
            userId: user.id,
            name: 'Admin User',
            email: 'admin@example.com',
            branchId: branch.id
        });
        console.log('Created Admin User: EMP001 / password123');

        // 3. Create Categories and Products
        const foodCategory = await Category.create({ name: 'Food', status: 'active' });
        const drinkCategory = await Category.create({ name: 'Drinks', status: 'active' });

        const burger = await Product.create({
            name: 'Chicken Burger',
            categoryId: foodCategory.id,
            code: 'FB001',
            sku: 'CH-BRG',
            status: 'active'
        });

        // Branch availability
        await ProductBranch.create({
            productId: burger.id,
            branchId: branch.id
        });

        const burgerVariation = await Variation.create({
            productId: burger.id,
            name: 'Regular',
            sku: 'CH-BRG-REG'
        });

        const burgerOption = await VariationOption.create({
            variationId: burgerVariation.id,
            name: 'Default'
        });

        await VariationPrice.create({
            variationOptionId: burgerOption.id,
            branchId: branch.id,
            price: 550.00
        });

        const coke = await Product.create({
            name: 'Coca Cola',
            categoryId: drinkCategory.id,
            code: 'DR001',
            sku: 'COKE-500',
            status: 'active'
        });

        await ProductBranch.create({
            productId: coke.id,
            branchId: branch.id
        });

        const cokeVariation = await Variation.create({
            productId: coke.id,
            name: '500ml',
            sku: 'COKE-500-ML'
        });

        const cokeOption = await VariationOption.create({
            variationId: cokeVariation.id,
            name: 'Bottle'
        });

        await VariationPrice.create({
            variationOptionId: cokeOption.id,
            branchId: branch.id,
            price: 150.00
        });
        console.log('Created Products and Categories.');

        // 4. Create Modifications
        const cheeseMod = await Modification.create({
            title: 'Extra Cheese'
        });

        const cheeseItem = await ModificationItem.create({
            modificationId: cheeseMod.id,
            title: 'Cheddar Cheese',
            price: 50.00
        });

        const prodMod = await ProductModification.create({
            productId: burger.id,
            modificationId: cheeseMod.id
        });
        console.log('Created Modifications.');

        // 5. Create Customer
        const customer = await Customer.create({
            name: 'John Doe',
            mobile: '0771234567',
            email: 'john@example.com'
        });
        console.log('Created Customer:', customer.name);

        // 6. Create Session
        const session = await Session.create({
            userId: user.id,
            branchId: branch.id,
            openingBalance: 5000.00,
            status: 'open'
        });
        console.log('Created Open Session for EMP001 at Main Branch.');

        // 7. Create Sample Orders
        await Order.create({
            userId: user.id,
            branchId: branch.id,
            customerId: customer.id,
            totalAmount: 750.00,
            status: 'completed',
            orderType: 'dine-in'
        });

        // Add 5 more orders to reach ID 7 for the verification script
        for (let i = 0; i < 5; i++) {
            await Order.create({
                userId: user.id,
                branchId: branch.id,
                customerId: customer.id,
                totalAmount: 100.00 * (i + 1),
                status: 'cancelled',
                orderType: 'take-away'
            });
        }

        const pendingOrder = await Order.create({
            userId: user.id,
            branchId: branch.id,
            customerId: customer.id,
            totalAmount: 1200.00,
            status: 'pending',
            orderType: 'delivery'
        });

        await OrderItem.create({
            orderId: pendingOrder.id,
            productId: burger.id,
            variationId: burgerVariation.id,
            quantity: 2,
            unitPrice: 550.00,
            totalPrice: 1100.00
        });

        console.log('Created Sample Orders (including pending and multiple cancelled orders).');

        console.log('\nDatabase reset and seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error during reset and seeding:', error);
        process.exit(1);
    }
}

resetAndSeed();
