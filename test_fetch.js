const sequelize = require('./src/config/database');
require('./src/models/associations');
const { getProductsByBranch } = require('./src/controllers/ProductController');
async function testFetch() {
    try {
        await sequelize.sync();
        console.log("Fetching products for branch 1...");

        let sentRes = null;
        const req = {
            params: { branchId: 1 },
            query: { status: 'all' }
        };
        const res = {
            json: (data) => {
                sentRes = data;
                console.log("Fetched Products:", JSON.stringify(data, null, 2));
            },
            status: (code) => {
                return { json: (msg) => console.log("Error", code, msg) };
            }
        };

        await getProductsByBranch(req, res);
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

testFetch();
