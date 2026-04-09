const sequelize = require('../src/config/database');
const Branch = require('../src/models/Branch');
const ServiceCharge = require('../src/models/ServiceCharge');
const DeliveryCharge = require('../src/models/DeliveryCharge');
const DeliveryChargeBranch = require('../src/models/DeliveryChargeBranch');
require('../src/models/associations'); // Load associations

async function updateCharges() {
    try {
        console.log('Starting database update for charges...');

        // 1. Fetch all branches
        const branches = await Branch.findAll({ where: { status: 'active' } });
        console.log(`Found ${branches.length} active branches.`);

        // 2. Update/Create Service Charges (Percentage: 0)
        console.log('Updating service charges to 0...');
        
        // Global service charge (branchId: null)
        await ServiceCharge.upsert({
            branchId: null,
            percentage: 0.00
        });

        // Branch-specific service charges
        for (const branch of branches) {
            await ServiceCharge.upsert({
                branchId: branch.id,
                percentage: 0.00
            });
        }
        console.log('Service charges updated.');

        // 3. Add Delivery Charges (Transport levels 1-7)
        console.log('Adding delivery charges...');
        
        const transportLevels = [
            { title: 'Transport level 1 (0.5km - 1km)', amount: 150 },
            { title: 'Transport level 2 (1km - 2km)', amount: 200 },
            { title: 'Transport level 3 (2km - 3km)', amount: 250 },
            { title: 'Transport level 4 (3km - 4km)', amount: 300 },
            { title: 'Transport level 5 (4km - 5km)', amount: 400 },
            { title: 'Transport level 6 (5km - 6km)', amount: 500 },
            { title: 'Transport level 7 (more than 6km)', amount: 600 },
        ];

        // Clear existing delivery charges to avoid duplicates (optional but recommended since specific list was given)
        // Since I checked and it was empty, this is safe anyway.
        // await DeliveryCharge.destroy({ where: {}, cascade: true }); 

        for (const level of transportLevels) {
            const dc = await DeliveryCharge.create({
                title: level.title,
                amount: level.amount,
                status: 'active'
            });

            // Link to all branches
            for (const branch of branches) {
                await DeliveryChargeBranch.create({
                    deliveryChargeId: dc.id,
                    branchId: branch.id
                });
            }
            console.log(`Created: ${level.title}`);
        }

        console.log('Database update completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error updating database:', error);
        process.exit(1);
    }
}

updateCharges();
