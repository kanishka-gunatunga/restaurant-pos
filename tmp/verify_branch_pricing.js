const ProductBundle = require('../src/models/ProductBundle');
const ProductBundleBranch = require('../src/models/ProductBundleBranch');
const ProductBundleItem = require('../src/models/ProductBundleItem');
const Branch = require('../src/models/Branch');
const Product = require('../src/models/Product');
const sequelize = require('../src/config/database');
require('../src/models/associations');

async function verify() {
    try {
        console.log('Running branch-specific pricing verification...');
        
        // 1. Find a product to use in the bundle
        const product = await Product.findOne();
        if (!product) {
            console.error('No products found to create a bundle.');
            process.exit(1);
        }

        // 2. Find two branches
        const branches = await Branch.findAll({ limit: 2 });
        if (branches.length < 2) {
            console.error('Need at least 2 branches for this test.');
            process.exit(1);
        }

        // 3. Create a bundle with different prices for each branch
        console.log(`Creating bundle with different prices for Branch ${branches[0].id} and Branch ${branches[1].id}...`);
        
        const transaction = await sequelize.transaction();
        try {
            const bundle = await ProductBundle.create({
                name: 'Verification Bundle ' + Date.now(),
                status: 'active'
            }, { transaction });

            await ProductBundleItem.create({
                productBundleId: bundle.id,
                productId: product.id,
                quantity: 1
            }, { transaction });

            await ProductBundleBranch.bulkCreate([
                {
                    productBundleId: bundle.id,
                    branchId: branches[0].id,
                    price: 90.00,
                    original_price: 100.00,
                    customer_saves: 10.00
                },
                {
                    productBundleId: bundle.id,
                    branchId: branches[1].id,
                    price: 85.00,
                    original_price: 105.00,
                    customer_saves: 20.00
                }
            ], { transaction });

            await transaction.commit();

            // 4. Fetch the bundle and verify
            const fetchedBundle = await ProductBundle.findByPk(bundle.id, {
                include: [
                    { model: ProductBundleBranch, as: 'branches' }
                ]
            });

            console.log('Verification Results:');
            console.log(`Bundle ID: ${fetchedBundle.id}`);
            
            fetchedBundle.branches.forEach(bb => {
                console.log(`Branch ${bb.branchId} Price: ${bb.price} (Original: ${bb.original_price}, Saved: ${bb.customer_saves})`);
            });

            const b1 = fetchedBundle.branches.find(b => b.branchId === branches[0].id);
            const b2 = fetchedBundle.branches.find(b => b.branchId === branches[1].id);

            if (b1.price == 90.00 && b2.price == 85.00) {
                console.log('SUCCESS: Branch-specific prices correctly stored and retrieved!');
            } else {
                console.error('FAILURE: Branch-specific prices do not match expected values.');
            }

            // Cleanup
            await ProductBundleBranch.destroy({ where: { productBundleId: bundle.id } });
            await ProductBundleItem.destroy({ where: { productBundleId: bundle.id } });
            await ProductBundle.destroy({ where: { id: bundle.id } });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verify();
