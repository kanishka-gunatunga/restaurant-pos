const { computeOrderTotalsFromLines } = require('./src/utils/orderTotals');
const templateService = require('./src/services/templateService');

const mockItems = [
    {
        quantity: 2,
        unitPrice: 100,
        productDiscount: 0,
        modifications: []
    }
];

const orderDiscount = 10;
const serviceCharge = 15;
const deliveryChargeAmount = 25;

const totals = computeOrderTotalsFromLines(mockItems, orderDiscount, serviceCharge, deliveryChargeAmount);

console.log('--- Totals ---');
console.log(JSON.stringify(totals, null, 2));

const mockOrder = {
    id: 123,
    createdAt: new Date(),
    orderDiscount,
    serviceCharge,
    deliveryChargeAmount,
    totalAmount: totals.totalAmount,
    items: mockItems.map(item => ({
        ...item,
        product: { name: 'Test Burger' }
    })),
    user: { name: 'Operator 1' }
};

const mockBranch = {
    id: 1,
    location: 'Main Branch',
    mobile: '123456789'
};

const structuredData = templateService.generateReceiptStructuredData(mockOrder, { paymentMethod: 'cash', amount: totals.totalAmount }, mockBranch);

console.log('\n--- Structured Data ---');
console.log(JSON.stringify(structuredData, null, 2));

const html = templateService.generateReceiptHtml(mockOrder, { paymentMethod: 'cash', amount: totals.totalAmount }, mockBranch);
console.log('\n--- HTML includes Charges ---');
console.log('Includes Service Charge:', html.includes('SERVICE CHARGE'));
console.log('Includes Delivery Charge:', html.includes('DELIVERY CHARGE'));
