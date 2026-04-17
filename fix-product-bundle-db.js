const sequelize = require('./src/config/database');

async function fixDatabase() {
    try {
        console.log('Starting targeted database fix for product_bundle_items...');

        // 1. Add modificationItemId column if it doesn't exist
        await sequelize.query(`
            ALTER TABLE product_bundle_items 
            ADD COLUMN IF NOT EXISTS modificationItemId INT NULL,
            ADD CONSTRAINT fk_bundle_item_modification 
            FOREIGN KEY IF NOT EXISTS (modificationItemId) 
            REFERENCES modificationitems(id) 
            ON DELETE SET NULL ON UPDATE CASCADE;
        `).catch(err => {
            console.log('Note: could not add modificationItemId column or constraint. It might already exist.');
            // console.error(err);
        });

        // 2. Make productId nullable
        await sequelize.query(`
            ALTER TABLE product_bundle_items 
            MODIFY COLUMN productId INT NULL;
        `).catch(err => {
            console.log('Note: could not modify productId column.');
            console.error(err);
        });

        console.log('Database fix completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing database:', error);
        process.exit(1);
    }
}

fixDatabase();
