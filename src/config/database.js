const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        dialectModule: require('mysql2'),
        logging: false,
        timezone: '+05:30',
        pool: {
            max: parseInt(process.env.DB_POOL_MAX) || 5, // Per app instance max
            min: 0,
            acquire: 30000,
            idle: 10000, // Release idle connections after 10s
            evict: 5000,  // Proactively evict stale connections every 5s
        }
    }
);

module.exports = sequelize;
