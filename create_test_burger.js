const Product = require('./src/models/Product');
const Variation = require('./src/models/Variation');
const VariationOption = require('./src/models/VariationOption');
const VariationPrice = require('./src/models/VariationPrice');
const Modification = require('./src/models/Modification');
const ModificationItem = require('./src/models/ModificationItem');
const ProductModification = require('./src/models/ProductModification');
const ProductBranch = require('./src/models/ProductBranch');
const sequelize = require('./src/config/database');
require('./src/models/associations'); // Init associations

async function createTestProduct() {
    const t = await sequelize.transaction();
    try {
        console.log('Creating Test Product: Mega Spicy Burger...');

        // 1. Create Product
        const product = await Product.create({
            name: 'Mega Spicy Burger',
            code: 'TEST-BURGER-MPB', // Required
            categoryId: 1, // Hot Kitchen
            image: 'test_burger.png',
            sku: 'SKU-TEST-MPB-001',
            status: 'active'
        }, { transaction: t });

        // 2. Associate with Branch
        await ProductBranch.create({
            productId: product.id,
            branchId: 1
        }, { transaction: t });

        // 3. Create Variation (Size)
        const variation = await Variation.create({
            productId: product.id,
            name: 'Size',
            status: 'active'
        }, { transaction: t });

        // 4. Create Variation Options (Regular, Large)
        const vRegular = await VariationOption.create({
            variationId: variation.id,
            name: 'Regular',
            status: 'active'
        }, { transaction: t });

        const vLarge = await VariationOption.create({
            variationId: variation.id,
            name: 'Large',
            status: 'active'
        }, { transaction: t });

        // 5. Set Variation Prices for Branch 1
        await VariationPrice.create({
            variationOptionId: vRegular.id,
            branchId: 1,
            price: 1200.00
        }, { transaction: t });

        await VariationPrice.create({
            variationOptionId: vLarge.id,
            branchId: 1,
            price: 1600.00
        }, { transaction: t });

        // 6. Create Modification (Add-ons)
        const modification = await Modification.create({
            title: 'Add-ons',
            status: 'active'
        }, { transaction: t });

        // 7. Create Modification Items (CheeseSlice, FriedEgg)
        const modItemCheese = await ModificationItem.create({
            modificationId: modification.id,
            title: 'Cheese Slice',
            price: 150.00,
            status: 'active'
        }, { transaction: t });

        const modItemEgg = await ModificationItem.create({
            modificationId: modification.id,
            title: 'Fried Egg',
            price: 100.00,
            status: 'active'
        }, { transaction: t });

        // 8. Associate Modification with Product
        await ProductModification.create({
            productId: product.id,
            modificationId: modification.id
        }, { transaction: t });

        await t.commit();
        console.log('Test product "Mega Spicy Burger" created successfully!');
        console.log(`Product ID: ${product.id}`);
        process.exit(0);
    } catch (err) {
        if (t && !t.finished) await t.rollback();
        console.error('Error creating test product:', err);
        process.exit(1);
    }
}

createTestProduct();
