const CustomerCategoryDiscount = require('../models/CustomerCategoryDiscount');
const { logActivity } = require('./ActivityLogController');
const UserDetail = require('../models/UserDetail');

exports.getAllDiscounts = async (req, res) => {
    try {
        // Ensure all categories exist in the table
        const categories = ['normal', 'staff', 'management'];
        for (const cat of categories) {
            await CustomerCategoryDiscount.findOrCreate({
                where: { category: cat },
                defaults: { discount_percentage: 0 }
            });
        }

        const discounts = await CustomerCategoryDiscount.findAll({
            order: [['category', 'ASC']]
        });
        res.json(discounts);
    } catch (error) {
        console.error('Category Discounts:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.upsertDiscounts = async (req, res) => {
    try {
        const { discounts } = req.body; // Array of { category, discount_percentage }
        
        if (!Array.isArray(discounts)) {
            return res.status(400).json({ message: 'Invalid discounts data' });
        }

        for (const item of discounts) {
            await CustomerCategoryDiscount.upsert({
                category: item.category,
                discount_percentage: item.discount_percentage
            });
        }

        const userDetail = await UserDetail.findOne({ where: { userId: req.user.id } });
        await logActivity({
            userId: req.user.id,
            branchId: userDetail?.branchId || 1,
            activityType: 'Category Discounts Updated',
            description: 'Customer category discounts updated',
            metadata: { discounts }
        });

        res.json({ message: 'Discounts updated successfully' });
    } catch (error) {
        console.error('Category Discounts:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};
