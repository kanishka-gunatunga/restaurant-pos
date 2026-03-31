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
        timezone: '+05:30', // Set timezone for DB connections
    }
);

module.exports = sequelize;
