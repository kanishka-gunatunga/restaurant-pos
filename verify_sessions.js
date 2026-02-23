const API_URL = 'http://localhost:5000/api';
let token = '';
let managerPasscode = '1234';

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(`Invalid JSON from ${url}: ${text.substring(0, 500)}`);
    }
    if (!res.ok) {
        throw new Error(`Request to ${url} failed with status ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
}

async function runTests() {
    try {
        console.log('--- Starting Sessions API Verification ---');

        // 1. Login
        console.log('Step 1: Logging in...');
        const loginData = await fetchJson(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'password123'
            })
        });
        token = loginData.token;
        console.log('Logged in successfully.');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // 2. Start a session
        console.log('\nStep 2: Starting session...');
        try {
            const startData = await fetchJson(`${API_URL}/sessions/start`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    startBalance: 150.00
                })
            });
            console.log('Session started (branchId auto-fetched):', startData);
        } catch (e) {
            if (e.message.includes('already have an active session')) {
                console.log('Session already active, continuing...');
            } else {
                throw e;
            }
        }

        // 3. Get active session
        console.log('\nStep 3: Getting active session...');
        const activeData = await fetchJson(`${API_URL}/sessions/active`, { headers });
        console.log('Active session:', activeData);

        // 4. Add Cash
        console.log('\nStep 4: Adding cash...');
        const addData = await fetchJson(`${API_URL}/sessions/cash-action`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                type: 'add',
                amount: 50.00,
                description: 'Float increase'
            })
        });
        console.log('Add cash result balance:', addData.session.currentBalance);

        // 5. Remove Cash
        console.log('\nStep 5: Removing cash...');
        const removeData = await fetchJson(`${API_URL}/sessions/cash-action`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                type: 'remove',
                amount: 30.00,
                description: 'Bank deposit'
            })
        });
        console.log('Remove cash result balance:', removeData.session.currentBalance);

        // 6. Simulate a Payment
        console.log('\nStep 6: Creating an order...');
        const orderData = await fetchJson(`${API_URL}/orders`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                totalAmount: 100.00,
                orderType: 'dine-in',
                order_products: []
            })
        });
        const orderId = orderData.id;
        console.log('Order created ID:', orderId);

        console.log('Creating a payment for order...');
        const paymentData = await fetchJson(`${API_URL}/payments`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                orderId: orderId,
                paymentMethod: 'cash',
                amount: 100.00,
                status: 'paid'
            })
        });
        console.log('Payment created:', paymentData);

        // 7. Verify balance update
        console.log('\nStep 7: Verifying balance after payment...');
        const verifyData = await fetchJson(`${API_URL}/sessions/active`, { headers });
        console.log('Current balance after payment:', verifyData.currentBalance);

        // 8. Test Refund
        console.log('\nStep 8: Testing refund integration...');
        const refundRes = await fetch(`${API_URL}/payments/${paymentData.id}/status`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                is_refund: 1
            })
        });
        const refundData = await refundRes.json();
        console.log('Payment refunded:', refundData);

        const verifyRefundRes = await fetch(`${API_URL}/sessions/active`, { headers });
        const verifyRefundData = await verifyRefundRes.json();
        console.log('Current balance after refund (Expected 330 - 100 = 230):', verifyRefundData.currentBalance);

        // 9. Close session
        console.log('\nStep 9: Closing session...');
        const closeData = await fetchJson(`${API_URL}/sessions/close`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                passcode: managerPasscode
            })
        });
        console.log('Session closed successfully');

        // 10. Verify session is history
        console.log('\nStep 10: Checking history...');
        const historyData = await fetchJson(`${API_URL}/sessions/history`, { headers });
        console.log('Sessions in history:', historyData.length);

        console.log('\n--- Verification Completed Successfully ---');
        process.exit(0);
    } catch (error) {
        console.error('\nVerification FAILED:', error.message);
        process.exit(1);
    }
}

runTests();
