const sequelize = require('../src/config/database');

async function cleanupIndexes() {
    try {
        const [results] = await sequelize.query('SHOW INDEX FROM user_details');
        const redundantIndexes = results
            .map(idx => idx.Key_name)
            .filter(name => name.startsWith('email_') || (name === 'email' && results.some(r => r.Key_name === 'email_2')));

        // Keep one 'email' index if possible, or just drop all email_* and let sequelize recreate 'email' once.
        // Actually, let's drop all email_* indexes.
        
        const toDrop = results
            .map(idx => idx.Key_name)
            .filter(name => /^email(_\d+)?$/.test(name));

        console.log(`Found ${toDrop.length} email indexes to drop:`, toDrop);

        for (const indexName of toDrop) {
            console.log(`Dropping index ${indexName}...`);
            await sequelize.query(`ALTER TABLE user_details DROP INDEX \`${indexName}\``);
        }

        console.log('Cleanup finished.');
    } catch (err) {
        console.error('Error during cleanup:', err);
    } finally {
        await sequelize.close();
    }
}

cleanupIndexes();
