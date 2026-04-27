const { Op } = require('sequelize');
const VariationPrice = require('../src/models/VariationPrice');
const VariationOption = require('../src/models/VariationOption');
const Variation = require('../src/models/Variation');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Branch = require('../src/models/Branch');
require('../src/models/associations'); // Load associations

async function testDashboard() {
    try {
        console.log('Testing expired items query...');
        const expiredItems = await VariationPrice.findAll({
            where: {
                expireDate: { [Op.lt]: new Date() }
            },
            include: [
                { model: Branch }, 
                {
                    model: VariationOption,
                    include: [
                        { model: Variation, include: [{ model: Product, include: [{ model: Category, as: 'category' }] }] }
                    ]
                }
            ],
            limit: 1
        });
        console.log('Query successful. Found:', expiredItems.length);
    } catch (err) {
        console.log('Test failed with message:', err.message);
        if (err.parent) {
            console.log('Parent error message:', err.parent.message);
        }
    } finally {
        const sequelize = require('../src/config/database');
        await sequelize.close();
    }
}

testDashboard();
