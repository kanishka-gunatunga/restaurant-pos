const Customer = require('../models/Customer');
const Order = require('../models/Order');

const POINT_VALUE = 1.0; // 1 point = 1 rupee

/**
 * Awards loyalty points to a customer based on an order's total amount.
 * Logic: 1 point per 1000 rupees.
 * Only applies to customers with a mobile number.
 * 
 * @param {number} orderId - The ID of the order.
 * @param {object} transaction - Sequelize transaction object.
 */
async function awardLoyaltyPoints(orderId, transaction) {
    try {
        const order = await Order.findByPk(orderId, {
            include: [{ model: Customer, as: 'customer' }],
            transaction
        });

        if (!order) return;

        // Points only apply to orders that are fully paid
        if (order.paymentStatus !== 'paid') return;

        // Identify "system customer" by presence of mobile number
        if (!order.customer || !order.customer.mobile) return;

        const totalAmount = parseFloat(order.totalAmount) || 0;
        const totalPointsPossible = Math.floor(totalAmount / 1000);
        
        const currentPointsEarned = order.loyaltyPointsEarned || 0;
        const pointsToAward = totalPointsPossible - currentPointsEarned;

        if (pointsToAward > 0) {
            // Update customer points
            await Customer.update(
                { loyalty_points: order.customer.loyalty_points + pointsToAward },
                { where: { id: order.customerId }, transaction }
            );

            // Update order points earned tracker
            await order.update(
                { loyaltyPointsEarned: currentPointsEarned + pointsToAward },
                { transaction }
            );

            console.log(`[LoyaltyService] Awarded ${pointsToAward} points to customer #${order.customerId} for order #${orderId}`);
        }
    } catch (error) {
        console.error('[LoyaltyService] Error awarding points:', error);
        throw error;
    }
}

/**
 * Redeems loyalty points for a customer.
 * 
 * @param {number} customerId - The ID of the customer.
 * @param {number} points - The number of points to redeem.
 * @param {object} transaction - Sequelize transaction object.
 */
async function redeemLoyaltyPoints(customerId, points, transaction) {
    try {
        const customer = await Customer.findByPk(customerId, { transaction });
        if (!customer) throw new Error('Customer not found');

        if (customer.loyalty_points < points) {
            throw new Error(`Insufficient loyalty points. Available: ${customer.loyalty_points}`);
        }

        const newPoints = customer.loyalty_points - points;
        await customer.update({ loyalty_points: newPoints }, { transaction });

        console.log(`[LoyaltyService] Redeemed ${points} points for customer #${customerId}. Remaining: ${newPoints}`);
        
        return {
            pointsRedeemed: points,
            monetaryValue: points * POINT_VALUE
        };
    } catch (error) {
        console.error('[LoyaltyService] Error redeeming points:', error);
        throw error;
    }
}

module.exports = {
    awardLoyaltyPoints,
    redeemLoyaltyPoints,
    POINT_VALUE
};
