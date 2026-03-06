const sequelize = require('./src/config/database');
const Branch = require('./src/models/Branch');
const Category = require('./src/models/Category');
const Product = require('./src/models/Product');
const Variation = require('./src/models/Variation');
const VariationOption = require('./src/models/VariationOption');
const VariationPrice = require('./src/models/VariationPrice');
const Discount = require('./src/models/Discount');
const DiscountItem = require('./src/models/DiscountItem');

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');

        // Create Branch if not exists
        let branch = await Branch.findOne();
        if (!branch) {
            branch = await Branch.create({ name: 'Main Branch', location: 'City Center' });
        }

        // Create Category
        const category = await Category.create({ name: 'Dummy Category ' + Date.now(), description: 'For testing' });

        // Expired Product Setup
        const prodExpired = await Product.create({ name: 'Expired Milk', code: 'EXP-MLK', categoryId: category.id });
        const varExpired = await Variation.create({ name: 'Size', productId: prodExpired.id });
        const optExpired = await VariationOption.create({ name: '1L', variationId: varExpired.id });

        let expireDate2DaysAgo = new Date();
        expireDate2DaysAgo.setDate(expireDate2DaysAgo.getDate() - 2);

        await VariationPrice.create({
            variationOptionId: optExpired.id,
            branchId: branch.id,
            price: 100,
            quantity: 50,
            batchNo: 'EXP-123',
            expireDate: expireDate2DaysAgo
        });

        // Low Stock Product Setup
        const prodLowStock = await Product.create({ name: 'Rare Truffle', code: 'R-TRF', categoryId: category.id });
        const varLowStock = await Variation.create({ name: 'Weight', productId: prodLowStock.id });
        const optLowStock = await VariationOption.create({ name: '50g', variationId: varLowStock.id });

        let expireDateFuture = new Date();
        expireDateFuture.setDate(expireDateFuture.getDate() + 30);

        await VariationPrice.create({
            variationOptionId: optLowStock.id,
            branchId: branch.id,
            price: 500,
            quantity: 3, // Low stock triggers <= 10
            batchNo: 'LOW-123',
            expireDate: expireDateFuture
        });

        // Additional Product to make discount count match "2 product(s) 4 variant(s)" roughly.
        // We will just add to 2 products and 4 variations.
        const prodOther = await Product.create({ name: 'Normal Item', code: 'NRM-ITM', categoryId: category.id });

        // Discount setup (expiring within 7 days)
        let expireDate4Days = new Date();
        expireDate4Days.setDate(expireDate4Days.getDate() + 4);

        const discount = await Discount.create({
            name: 'Weekend Special Sale',
            status: 'active',
            expiryDate: expireDate4Days
        });

        // Add 2 products and a few variations to the discount to test counts
        await DiscountItem.create({
            discountId: discount.id,
            productId: prodExpired.id,
            discountType: 'percentage',
            discountValue: 20
        });

        await DiscountItem.create({
            discountId: discount.id,
            productId: prodOther.id,
            discountType: 'percentage',
            discountValue: 20
        });

        await DiscountItem.create({
            discountId: discount.id,
            variationOptionId: optLowStock.id,
            discountType: 'fixed',
            discountValue: 50
        });

        await DiscountItem.create({
            discountId: discount.id,
            variationOptionId: optExpired.id,
            discountType: 'percentage',
            discountValue: 15
        });

        console.log('Dummy data seeded successfully!');
    } catch (err) {
        console.error('Error seeding data:', err);
    } finally {
        process.exit();
    }
}

seed();
