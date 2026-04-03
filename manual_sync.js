const sequelize = require('./src/config/database');
require('./src/models/associations');

async function syncDb() {
    try {
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully with alter: true');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing database:', error);
        process.exit(1);
    }
}

syncDb();
