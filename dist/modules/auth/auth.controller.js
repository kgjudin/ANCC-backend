"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.getMe = getMe;
exports.logout = logout;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("../../config/db.js");
const env_js_1 = require("../../config/env.js");
const validation_1 = require("@construction/validation");
const audit_service_js_1 = require("../../services/audit.service.js");
const constants_1 = require("@construction/constants");
async function login(req, res, next) {
    try {
        const { email, password } = validation_1.LoginSchema.parse(req.body);
        // Query user & employee profile
        const userRows = await (0, db_js_1.query)(`SELECT u.id as user_id, u.email, u.company_id, u.status, e.id as employee_id, e.full_name, e.status as emp_status
       FROM users u
       JOIN employees e ON e.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)`, [email]);
        if (userRows.length === 0) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
            });
        }
        const user = userRows[0];
        if (user.status !== 'Active' || user.emp_status !== 'Active') {
            return res.status(403).json({
                success: false,
                error: { code: 'ACCOUNT_DISABLED', message: 'Employee account is inactive or resigned' }
            });
        }
        // Generate JWT Session Token
        const token = jsonwebtoken_1.default.sign({
            userId: user.user_id,
            email: user.email,
            companyId: user.company_id
        }, env_js_1.ENV.JWT_SECRET, { expiresIn: '7d' });
        // Log login audit
        await (0, audit_service_js_1.logAudit)({
            actorUserId: user.user_id,
            actorEmployeeId: user.employee_id,
            action: 'LOGIN',
            module: constants_1.AUDIT_MODULES.AUTH,
            entityType: 'User',
            entityId: user.user_id,
            changeMetadata: { email: user.email, login_time: new Date().toISOString() }
        });
        return res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user.user_id,
                    email: user.email,
                    company_id: user.company_id
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
}
async function getMe(req, res, next) {
    const authReq = req;
    try {
        if (!authReq.user || !authReq.employee) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        }
        // Get User Role details
        let role = null;
        try {
            const roleRows = await (0, db_js_1.query)(`SELECT r.id, r.name, r.description, r.is_system
         FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1`, [authReq.user.id]);
            if (roleRows && roleRows.length > 0) {
                role = roleRows[0];
            }
        }
        catch (err) {
            // Fallback
        }
        if (!role && authReq.employee) {
            const empRoleName = authReq.employee.role_name || 'Super Admin';
            const empRoleId = authReq.employee.role_id || '10000000-0000-0000-0000-000000000001';
            role = {
                id: empRoleId,
                name: empRoleName,
                description: `${empRoleName} Role`,
                is_system: true
            };
        }
        return res.json({
            success: true,
            data: {
                user: authReq.user,
                employee: authReq.employee,
                role,
                permissions: authReq.permissions || []
            }
        });
    }
    catch (error) {
        next(error);
    }
}
async function logout(req, res, next) {
    const authReq = req;
    try {
        if (authReq.employee) {
            await (0, audit_service_js_1.logAudit)({
                actorUserId: authReq.user?.id,
                actorEmployeeId: authReq.employee.id,
                action: 'LOGOUT',
                module: constants_1.AUDIT_MODULES.AUTH,
                entityType: 'User',
                entityId: authReq.user?.id
            });
        }
        return res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        next(error);
    }
}
