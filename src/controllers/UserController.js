const User = require('../models/User');
const UserDetail = require('../models/UserDetail');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { username, password, role, name, employeeId, email, branchId, passcode } = req.body;

        // Validate required fields for all users
        if (!username || !password || !role || !name || !employeeId) {
            return res.status(400).json({
                message: 'Missing required fields: username, password, role, name, employeeId',
            });
        }

        // Passcode required for admin and manager only
        if (['admin', 'manager'].includes(role) && !passcode) {
            return res.status(400).json({
                message: 'Passcode is required for admin and manager roles',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPasscode = ['admin', 'manager'].includes(role)
            ? await bcrypt.hash(passcode, 10)
            : null;

        const user = await User.create({
            username,
            password: hashedPassword,
            role,
            passcode: hashedPasscode,
        });

        await UserDetail.create({
            userId: user.id,
            name,
            employeeId,
            email: email || null,
            branchId: branchId ?? 1,
        });

        res.status(201).json({ message: 'User created', userId: user.id });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({
            where: { username },
            include: [{ model: UserDetail, as: 'UserDetail' }],
        });

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.status !== 'active') return res.status(403).json({ message: 'Account is inactive' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '1d',
        });

        const userDetail = user.UserDetail;
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                status: user.status,
                name: userDetail?.name,
                employeeId: userDetail?.employeeId,
                email: userDetail?.email,
                branchId: userDetail?.branchId,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.verifyPasscode = async (req, res) => {
    try {
        const { passcode } = req.body;
        const userId = req.user?.id;

        if (!userId || !passcode) {
            return res.status(400).json({ message: 'Passcode is required' });
        }

        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ message: 'Passcode verification is only for admin and manager' });
        }

        if (!user.passcode) {
            return res.status(400).json({ message: 'No passcode set for this user' });
        }

        const isMatch = await bcrypt.compare(passcode, user.passcode);
        if (!isMatch) return res.status(401).json({ message: 'Invalid passcode' });

        res.json({ message: 'Passcode verified', verified: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
