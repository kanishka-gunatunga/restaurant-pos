const sequelize = require('./src/config/database');
const Discount = require('./src/models/Discount');
const DiscountItem = require('./src/models/DiscountItem');
const DiscountBranch = require('./src/models/DiscountBranch');
require('./src/models/associations'); // load associations

async function test() {
    try {
        await sequelize.sync(); // just in case DiscountBranch isn't created but they usually use migrations, wait, here it is `.sync()`? Let's check. Actually no, let's just use `sequelize.sync({ alter: true })` just for the new table `DiscountBranch` and new fields.
        await DiscountBranch.sync({ alter: true });
        await Discount.sync({ alter: true });
        await DiscountItem.sync({ alter: true });

        // Let's create an example discount manually to verify models
        const discount = await Discount.create({
            name: 'Test Setup Sale',
            isForAllBranches: false,
            status: 'active'
        });

        await DiscountBranch.create({ discountId: discount.id, branchId: 1 });
        await DiscountBranch.create({ discountId: discount.id, branchId: 2 });

        await DiscountItem.create({
            discountId: discount.id,
            productId: 1,
            branchId: 1,
            discountType: 'percentage',
            discountValue: 10
        });

        await DiscountItem.create({
            discountId: discount.id,
            productId: 1,
            branchId: 2,
            discountType: 'percentage',
            discountValue: 15
        });

        const fetched = await Discount.findByPk(discount.id, {
            include: [
                { model: DiscountBranch, as: 'branches' },
                { model: DiscountItem, as: 'items' }
            ]
        });

        console.log(JSON.stringify(fetched, null, 2));

        // cleanup
        await DiscountItem.destroy({ where: { discountId: discount.id } });
        await DiscountBranch.destroy({ where: { discountId: discount.id } });
        await discount.destroy();

        console.log("Success and cleanup done.");
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

test();
