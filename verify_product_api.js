const http = require('http');

const API_OPTS = {
    hostname: 'localhost',
    port: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
};

let authToken = '';

function request(method, path, data, isAuth = false) {
    return new Promise((resolve, reject) => {
        const basePath = isAuth ? '/api/auth' : '/api/products';
        const options = {
            ...API_OPTS,
            method,
            path: `${basePath}${path}`,
            headers: {
                ...API_OPTS.headers,
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            }
        };

        const req = http.request(options, (res) => {
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

async function verifyProducts() {
    try {
        console.log('--- Step 0: Login to get token ---');
        const loginRes = await request('POST', '/login', { employeeId: 'EMP001', password: 'password123' }, true);
        if (loginRes.status !== 200 || !loginRes.data.token) {
            throw new Error('Login failed');
        }
        authToken = loginRes.data.token;
        console.log('Login successful.');

        console.log('\n--- Testing Create Product with Mod/Variations/Options ---');
        const createPayload = {
            name: 'API Test Pizza',
            code: 'TEST001',
            sku: 'TS-PZ-01',
            branches: [1],
            categoryId: 1,
            variations: [
                {
                    name: 'Size',
                    options: [
                        {
                            name: 'Small',
                            prices: [
                                {
                                    branchId: 1,
                                    quantity: 50,
                                    price: 1500.00,
                                    discountPrice: 1400.00,
                                    expireDate: "2024-12-31",
                                    batchNo: "BATCH-S-01"
                                }
                            ]
                        }
                    ],
                    modifications: [
                        {
                            modificationId: 1 // Extant Mod Group from Seed
                        }
                    ]
                }
            ],
            modifications: [
                // No product level modifications for this test, keeping it clean to variation level
            ]
        };

        const createRes = await request('POST', '/', createPayload);
        console.log('Create Response Status:', createRes.status);
        if (createRes.status !== 201) {
            console.error(createRes.data);
            throw new Error('Create failed');
        }

        const productId = createRes.data.id;
        console.log('Created Product ID:', productId);

        console.log('\n--- Testing Get Product By ID ---');
        const getRes = await request('GET', `/${productId}`);
        console.log('Get Response Status:', getRes.status);
        console.log(JSON.stringify(getRes.data, null, 2));

        console.log('\n--- Testing Update Product (Updating Option/Branch) ---');
        const updatePayload = {
            ...createPayload,
            name: 'API Test Pizza Updated',
            branches: [1], // Re-sync branch
            variations: [
                {
                    name: 'Size',
                    options: [
                        {
                            name: 'Large', // Changed from Small to Large
                            prices: [
                                {
                                    branchId: 1,
                                    quantity: 10,
                                    price: 3000.00,
                                    discountPrice: 2800.00,
                                    expireDate: "2025-01-31",
                                    batchNo: "BATCH-L-01"
                                }
                            ]
                        }
                    ],
                    modifications: [
                        {
                            modificationId: 1
                        }
                    ]
                }
            ]
        };
        const updateRes = await request('PUT', `/${productId}`, updatePayload);
        console.log('Update Response Status:', updateRes.status);
        console.log(updateRes.data);

        console.log('\n--- Testing Get Product By ID After Update ---');
        const getUpdatedRes = await request('GET', `/${productId}`);
        console.log(JSON.stringify(getUpdatedRes.data, null, 2));

        console.log('\nVerification APIs completed successfully!');
    } catch (error) {
        console.error('Verification Failed:', error.message);
        console.log('Note: Ensure the server is running on port 5000 (npm run dev)');
    }
}

verifyProducts();
