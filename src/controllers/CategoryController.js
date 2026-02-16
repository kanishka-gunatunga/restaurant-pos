const Category = require('../models/Category');

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({
            include: [{ model: Category, as: 'subcategories' }],
            where: { parentId: null }, // Fetch only top-level categories by default or all? 
            // Let's fetch top-level and include subcategories.
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, parentId } = req.body;
        const category = await Category.create({
            name,
            parentId: parentId === '' ? null : parentId
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.update(req.body, { where: { id } });
        res.json({ message: 'Category updated' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.destroy({ where: { id } });
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getParentCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({
            where: { parentId: null }
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getSubCategories = async (req, res) => {
    try {
        const { parentId } = req.params;
        const categories = await Category.findAll({
            where: { parentId }
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByPk(id, {
            include: [
                { model: Category, as: 'subcategories' },
                { model: Category, as: 'parent' }
            ]
        });
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
