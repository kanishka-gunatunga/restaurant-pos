const User = require('../models/User');
const UserDetail = require('../models/UserDetail');
const Branch = require('../models/Branch');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { encrypt, decrypt } = require('../utils/crypto');
const { invalidManagerPasscode } = require('../utils/managerPasscodeResponse');
const { logActivity } = require('./ActivityLogController');

exports.register = async (req, res) => {
    try {
        const { password, role, name, employeeId, email, branchId, passcode } = req.body;

        // Validate required fields for all users
        if (!password || !role || !name || !employeeId) {
            return res.status(400).json({
                message: 'Missing required fields: password, role, name, employeeId',
            });
        }

        // Passcode required for admin and manager only
        if (['admin', 'manager'].includes(role) && !passcode) {
            return res.status(400).json({
                message: 'Passcode is required for admin and manager roles',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const encryptedPasscode = ['admin', 'manager'].includes(role)
            ? encrypt(passcode)
            : null;

        const user = await User.create({
            employeeId,
            password: hashedPassword,
            role,
            passcode: encryptedPasscode,
        });

        await UserDetail.create({
            userId: user.id,
            name,
            email: email || null,
            branchId: branchId ?? 1,
        });

        await logActivity({
            userId: req.user?.id || user.id, // req.user if created by admin, user.id if self-register (though me is protected)
            branchId: branchId ?? 1,
            activityType: 'User Created',
            description: `New user ${name} (${employeeId}) created with role ${role}`,
            metadata: { employeeId, role, name }
        });

        res.status(201).json({ message: 'User created', userId: user.id });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            const field = error.errors?.[0]?.path || error.fields?.[0];
            let msg = 'Unique field';
            if (field === 'employee_id' || field === 'users.employee_id') msg = 'Employee ID';
            if (field === 'email' || field === 'user_details.email') msg = 'Email';

            return res.status(400).json({
                message: `${msg} already exists. Try a different value.`,
            });
        }
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({ message: 'Branch not found. Ensure branchId exists in branches table.' });
        }
        res.status(400).json({ message: error.message });
    }
};

exports.login = async (req, res) => {
    const { auditLog } = require('../utils/auditLogger');
    const ip = req.ip;

    try {
        const { employeeId, password } = req.body;

        if (!employeeId || !password) {
            auditLog('login_failed', { ip, path: '/api/auth/login', reason: 'missing_credentials' });
            return res.status(400).json({ message: 'Employee ID and password are required' });
        }

        const user = await User.findOne({
            where: { employeeId },
            include: [{ model: UserDetail, as: 'UserDetail' }],
        });

        if (!user) {
            auditLog('login_failed', { ip, path: '/api/auth/login', reason: 'user_not_found', metadata: { employeeId: String(employeeId).slice(0, 8) + '***' } });
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.status !== 'active') {
            auditLog('login_failed', { ip, path: '/api/auth/login', reason: 'account_inactive', userId: user.id });
            return res.status(403).json({ message: 'Account is inactive' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            auditLog('login_failed', { ip, path: '/api/auth/login', reason: 'invalid_password', userId: user.id });
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'secret');
        if (!jwtSecret) return res.status(500).json({ message: 'Server configuration error' });
        const expiresIn = process.env.JWT_EXPIRES_IN || '12h';
        const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn });

        auditLog('login_success', { ip, path: '/api/auth/login', userId: user.id });

        const userDetail = user.UserDetail;
        await logActivity({
            userId: user.id,
            branchId: userDetail?.branchId || null,
            activityType: 'Login',
            description: `User ${user.employeeId} logged in`,
        });

        res.json({
            token,
            user: {
                id: user.id,
                employeeId: user.employeeId,
                role: user.role,
                status: user.status,
                name: userDetail?.name,
                email: userDetail?.email,
                branchId: userDetail?.branchId,
            },
        });
    } catch (error) {
        auditLog('login_failed', { ip, path: '/api/auth/login', reason: 'server_error' });
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

        const decryptedPasscode = decrypt(user.passcode);
        if (passcode !== decryptedPasscode) {
            return invalidManagerPasscode(res, 'Invalid passcode');
        }

        res.json({ message: 'Passcode verified', verified: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [
                {
                    model: UserDetail,
                    as: 'UserDetail',
                    include: [
                        {
                            model: Branch,
                            as: 'Branch',
                            attributes: ['id', 'name'],
                            required: false,
                        },
                    ],
                },
            ],
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        const userDetail = user.UserDetail;
        res.json({
            user: {
                id: user.id,
                employeeId: user.employeeId,
                role: user.role,
                status: user.status,
                name: userDetail?.name,
                email: userDetail?.email,
                branchId: userDetail?.branchId,
                branchName: userDetail?.Branch?.name ?? null,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Helper: format user for response (no password, passcode)
function formatUserResponse(user) {
    const userDetail = user.UserDetail;
    return {
        id: user.id,
        employeeId: user.employeeId,
        role: user.role,
        passcode: user.passcode,
        status: user.status,
        name: userDetail?.name,
        email: userDetail?.email,
        branchId: userDetail?.branchId,
    };
}

exports.getPasscode = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id);

        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!['admin', 'manager'].includes(user.role)) {
            return res.status(400).json({ message: 'Passcode only available for admin and manager' });
        }

        if (!user.passcode) {
            return res.status(404).json({ message: 'No passcode set for this user' });
        }

        const decryptedPasscode = decrypt(user.passcode);
        res.json({ passcode: decryptedPasscode });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.searchUsers = async (req, res) => {
    try {
        const { name, role, status } = req.query;
        const { Op } = require('sequelize');

        let statusFilter = { status: 'active' };
        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const where = { ...statusFilter };
        if (role) {
            where.role = role;
        }

        const userDetailWhere = {};
        if (name) {
            userDetailWhere.name = { [Op.like]: `%${name}%` };
        }

        const users = await User.findAll({
            where,
            include: [{
                model: UserDetail,
                as: 'UserDetail',
                where: Object.keys(userDetailWhere).length > 0 ? userDetailWhere : undefined
            }],
            order: [['id', 'ASC']],
        });

        const formatted = users.map((u) => formatUserResponse(u));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const { status } = req.query;
        let statusFilter = { status: 'active' };

        if (status === 'inactive') {
            statusFilter = { status: 'inactive' };
        } else if (status === 'all') {
            statusFilter = {};
        }

        const users = await User.findAll({
            where: statusFilter,
            include: [{ model: UserDetail, as: 'UserDetail' }],
            order: [['id', 'ASC']],
        });

        const formatted = users.map((u) => formatUserResponse(u));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id, {
            include: [{ model: UserDetail, as: 'UserDetail' }],
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json(formatUserResponse(user));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, branchId, employeeId, role, status, passcode } = req.body;

        const user = await User.findByPk(id, {
            include: [{ model: UserDetail, as: 'UserDetail' }],
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        // Update User table
        if (role !== undefined) user.role = role;
        if (status !== undefined) user.status = status;
        if (employeeId !== undefined) user.employeeId = employeeId;
        if (passcode !== undefined && ['admin', 'manager'].includes(user.role)) {
            user.passcode = encrypt(passcode);
        }
        await user.save();

        // Update UserDetail table
        const userDetail = await UserDetail.findOne({ where: { userId: id } });
        if (userDetail) {
            if (name !== undefined) userDetail.name = name;
            if (email !== undefined) userDetail.email = email;
            if (branchId !== undefined) userDetail.branchId = branchId;
            await userDetail.save();
        }

        // Fetch updated user with details
        const updated = await User.findByPk(id, {
            include: [{ model: UserDetail, as: 'UserDetail' }],
        });

        await logActivity({
            userId: req.user.id,
            branchId: updated.UserDetail?.branchId || 1,
            activityType: 'User Updated',
            description: `User ${updated.UserDetail?.name || updated.employeeId} updated`,
            metadata: { updatedFields: { name, email, branchId, employeeId, role, status } }
        });

        res.json(formatUserResponse(updated));
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deactivateUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.id === req.user.id) {
            return res.status(400).json({ message: 'Cannot deactivate your own account' });
        }

        user.status = 'inactive';
        await user.save();

        await logActivity({
            userId: req.user.id,
            branchId: req.user.UserDetail?.branchId || 1,
            activityType: 'User Deactivated',
            description: `User ID ${id} deactivated`,
            metadata: { targetUserId: id }
        });

        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.activateUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.status = 'active';
        await user.save();

        await logActivity({
            userId: req.user.id,
            branchId: req.user.UserDetail?.branchId || 1,
            activityType: 'User Activated',
            description: `User ID ${id} activated`,
            metadata: { targetUserId: id }
        });

        res.json({ message: 'User activated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};