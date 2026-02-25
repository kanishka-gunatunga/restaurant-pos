const Customer = require('./src/models/Customer');
require('./src/models/associations');
const sequelize = require('./src/config/database');
const CustomerController = require('./src/controllers/CustomerController');

async function verifyCustomerStatus() {
    try {
        console.log('\n--- Verifying Customer Status Parameter Logic ---\n');

        let responseData = null;
        const mockRes = {
            json: (data) => { responseData = data; return data; },
            status: (code) => {
                // console.log(`  DEBUG: res.status(${code}) called`);
                return {
                    json: (data) => { responseData = data; return { code, data }; }
                };
            },
            getResponse: () => responseData
        };

        const mobile = '0777123456';
        await Customer.destroy({ where: { mobile }, force: true });
        const customer = await Customer.create({ name: 'Status Test Customer', mobile: mobile, status: 'active' });
        await Customer.update({ status: 'inactive' }, { where: { id: customer.id } });
        console.log('  Created and Deactivated Customer (id:', customer.id, ')');

        const checkResults = async (query, label) => {
            console.log(`\nTesting ${label}:`);
            await CustomerController.getAllCustomers({ query }, mockRes);
            let result = mockRes.getResponse();

            // Sequelize grouped query result check
            if (!Array.isArray(result)) {
                // If it's a single object (happens sometimes with specific group configs)
                if (result && result.id === customer.id) {
                    return result;
                }
                console.log('  DEBUG: result content:', JSON.stringify(result, null, 2));
                return null;
            }

            let found = result.find(c => c.id === customer.id || (c.dataValues && c.dataValues.id === customer.id));
            return found;
        };

        // 2. Test ?status=active (Default)
        let found = await checkResults({}, '?status=active (Default)');
        console.log('  Found Inactive Customer:', found ? 'YES (ERROR)' : 'NO (OK)');

        // 3. Test ?status=inactive
        found = await checkResults({ status: 'inactive' }, '?status=inactive');
        console.log('  Found Inactive Customer:', found ? 'YES (OK)' : 'NO (ERROR)');

        // 4. Test ?status=all
        found = await checkResults({ status: 'all' }, '?status=all');
        console.log('  Found Inactive Customer:', found ? 'YES (OK)' : 'NO (ERROR)');

        // 5. Test activating
        console.log('\nTesting Activation:');
        await CustomerController.activateCustomer({ params: { id: customer.id } }, mockRes);
        const activated = await Customer.findByPk(customer.id);
        console.log('  Status after activation:', activated.status, activated.status === 'active' ? '(OK)' : '(ERROR)');

        console.log('\n--- Customer Status Verification Complete ---');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await Customer.destroy({ where: { mobile: '0777123456' }, force: true });
        await sequelize.close();
    }
}

verifyCustomerStatus();
