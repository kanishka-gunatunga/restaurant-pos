const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
let token = '';

async function login() {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin', // Adjust as needed
            password: 'password123' // Adjust as needed
        });
        token = response.data.token;
        console.log('Login successful');
    } catch (error) {
        console.error('Login failed:', error.response?.data || error.message);
    }
}

async function testReturns() {
    if (!token) return;

    try {
        // 1. Search for an order
        console.log('Searching for order...');
        const orderResponse = await axios.get(`${API_URL}/returns/search-order/1`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const order = orderResponse.data;
        console.log('Order found:', order.orderNo);

        // 2. Create a return
        console.log('Creating return...');
        const returnResponse = await axios.post(`${API_URL}/returns`, {
            orderId: order.id,
            orderNo: order.orderNo,
            refundMethod: 'store_credit',
            items: order.items.map(item => ({
                productId: item.productId,
                variationOptionId: item.variationOptionId,
                quantity: 1,
                unitPrice: item.unitPrice
            }))
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Return created:', returnResponse.data.id, 'QR:', returnResponse.data.qrCode);

        // 3. Get return by ID
        console.log('Fetching return details...');
        const getResponse = await axios.get(`${API_URL}/returns/${returnResponse.data.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Return details fetched successfully');

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

// Note: This script requires the server to be running.
// login().then(testReturns);
console.log('Verification script created. Please run the server and then execute this script.');
