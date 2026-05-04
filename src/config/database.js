const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

if (!global.sequelize) {
    global.sequelize = new Sequelize(
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
                max: 2,
                min: 0,
                acquire: 30000,
                idle: 10000,
                evict: 5000,
            }
        }
    );
}

sequelize = global.sequelize;

module.exports = sequelize;