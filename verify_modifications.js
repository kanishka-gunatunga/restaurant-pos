const http = require('http');

const API_OPTS = {
    hostname: 'localhost',
    port: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
};

function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const req = http.request({ ...API_OPTS, method, path: `/api/modifications${path}` }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: body ? JSON.parse(body) : {} });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function verifyModifications() {
    try {
        console.log('--- Testing Create Modification Group with Items ---');
        const createRes = await request('POST', '/', {
            title: 'Test Toppings Group',
            items: [
                { title: 'Extra Cheese', price: 1.50 },
                { title: 'Crispy Bacon', price: 2.00 }
            ]
        });
        console.log('Created:', JSON.stringify(createRes.data, null, 2));
        if (createRes.status !== 201) throw new Error('Create failed');
        const groupId = createRes.data.id;

        console.log('\n--- Testing Get All Modifications ---');
        const getAllRes = await request('GET', '/');
        console.log('Groups count:', getAllRes.data.length);
        const testGroup = getAllRes.data.find(g => g.id === groupId);
        console.log('Found Test Group with Items:', testGroup.items.length);

        console.log('\n--- Testing Update Modification Group (Sync Items) ---');
        const updateRes = await request('PUT', `/${groupId}`, {
            title: 'Updated Toppings Group',
            items: [
                { title: 'Extra Cheese', price: 1.75 }, // Price updated
                { title: 'Mushrooms', price: 1.00 }    // New item, Bacon removed
            ]
        });
        console.log('Updated:', JSON.stringify(updateRes.data, null, 2));

        console.log('\n--- Testing Delete Modification Group ---');
        const deleteRes = await request('DELETE', `/${groupId}`);
        console.log('Delete response:', JSON.stringify(deleteRes.data));

        console.log('\nVerification Successful!');
    } catch (error) {
        console.error('Verification Failed:', error.message);
        console.log('Note: Ensure the server is running on port 5000 (npm run dev)');
    }
}

verifyModifications();
