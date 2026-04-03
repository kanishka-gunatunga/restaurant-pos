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
        const basePath = isAuth ? '/api/auth' : '/api/service-charges';
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

async function verifyBranchServiceCharge() {
    try {
        console.log('--- Step 0: Login to get token ---');
        // Note: Using the same test user as in the other test script
        const loginRes = await request('POST', '/login', { employeeId: 'EMP_TEST_01', password: 'testpass123' }, true);
        if (loginRes.status !== 200 || !loginRes.data.token) {
            throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
        }
        authToken = loginRes.data.token;
        console.log('Login successful.');

        console.log('\n--- Step 1: UPDATE global service charge to 5% ---');
        const updateGlobalRes = await request('PUT', '/', { percentage: 5.00 });
        console.log('Global Update status:', updateGlobalRes.status, 'Data:', updateGlobalRes.data);

        console.log('\n--- Step 2: UPDATE branch 1 service charge to 12% ---');
        const updateBranchRes = await request('PUT', '/', { percentage: 12.00, branchId: 1 });
        console.log('Branch Update status:', updateBranchRes.status, 'Data:', updateBranchRes.data);

        console.log('\n--- Step 3: GET service charge for branch 1 ---');
        const getBranch1Res = await request('GET', '/1');
        console.log('GET Branch 1 status:', getBranch1Res.status, 'Percentage:', getBranch1Res.data.percentage);

        console.log('\n--- Step 4: GET service charge for branch 2 (fallback to global) ---');
        const getBranch2Res = await request('GET', '/2');
        console.log('GET Branch 2 status:', getBranch2Res.status, 'Percentage:', getBranch2Res.data.percentage);
        
        console.log('\n--- Step 5: GET global service charge (query param) ---');
        const getGlobalRes = await request('GET', '/');
        console.log('GET Global status:', getGlobalRes.status, 'Percentage:', getGlobalRes.data.percentage);

        if (parseFloat(getBranch1Res.data.percentage) === 12.00 && 
            parseFloat(getBranch2Res.data.percentage) === 5.00 &&
            parseFloat(getGlobalRes.data.percentage) === 5.00) {
            console.log('\nBranch-specific verification completed successfully!');
        } else {
            console.error('\nVerification failed: Response data mismatch.');
            console.log('Branch 1 Expected 12.00, Got:', getBranch1Res.data.percentage);
            console.log('Branch 2 Expected 5.00 (fallback), Got:', getBranch2Res.data.percentage);
            console.log('Global Expected 5.00, Got:', getGlobalRes.data.percentage);
        }

    } catch (error) {
        console.error('Verification Failed:', error.message);
        console.log('Note: Ensure the server is running on port 5000 (npm run dev)');
    }
}

verifyBranchServiceCharge();
