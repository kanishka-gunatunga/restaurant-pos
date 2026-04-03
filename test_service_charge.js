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
        const basePath = isAuth ? '/api/auth' : '/api/service-charge';
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

async function verifyServiceCharge() {
    try {
        console.log('--- Step 0: Login to get token ---');
        const loginRes = await request('POST', '/login', { employeeId: 'EMP_TEST_01', password: 'testpass123' }, true);
        if (loginRes.status !== 200 || !loginRes.data.token) {
            throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
        }
        authToken = loginRes.data.token;
        console.log('Login successful.');

        console.log('\n--- Step 1: GET current service charge ---');
        const getRes = await request('GET', '/');
        console.log('GET Response Status:', getRes.status);
        console.log('Current Service Charge:', getRes.data);

        console.log('\n--- Step 2: UPDATE service charge to 10% ---');
        const updateRes = await request('PUT', '/', { percentage: 10.00 });
        console.log('UPDATE Response Status:', updateRes.status);
        console.log('Updated Service Charge:', updateRes.data);

        console.log('\n--- Step 3: GET current service charge again ---');
        const getRes2 = await request('GET', '/');
        console.log('GET Response Status:', getRes2.status);
        console.log('Current Service Charge:', getRes2.data);

        if (parseFloat(getRes2.data.percentage) === 10.00) {
            console.log('\nVerification completed successfully!');
        } else {
            throw new Error('Verification failed: percentage mismatch');
        }

    } catch (error) {
        console.error('Verification Failed:', error.message);
        console.log('Note: Ensure the server is running on port 5000 (npm run dev)');
    }
}

verifyServiceCharge();
