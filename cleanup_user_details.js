const sequelize = require('./src/config/database');

async function cleanupUserDetails() {
    try {
        console.log('--- Cleaning up user_details table ---');

        // 1. Drop redundant email indices
        for (let i = 2; i <= 56; i++) {
            try {
                await sequelize.query(`ALTER TABLE user_details DROP INDEX email_${i}`);
                console.log(`Dropped index email_${i}`);
            } catch (err) {
                // If it doesn't exist, just skip
            }
        }

        // 2. Drop specific foreign key constraints that might be causing issues
        const fks = ['user_details_ibfk_16', 'user_details_ibfk_17', 'user_details_ibfk_18', 'user_details_ibfk_19'];
        for (const fk of fks) {
            try {
                await sequelize.query(`ALTER TABLE user_details DROP FOREIGN KEY ${fk}`);
                console.log(`Dropped foreign key ${fk}`);
            } catch (err) {
                // If it doesn't exist, just skip
            }
        }

        console.log('Cleanup completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanupUserDetails();
