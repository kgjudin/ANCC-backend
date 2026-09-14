"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
function requirePermission(requiredPermission) {
    return (req, res, next) => {
        // Super Admin / System Administrator override - Grant full unrestricted access across all endpoints
        if (req.employee?.role_name === 'Super Admin' ||
            req.user?.email === 'admin@construction.com' ||
            req.employee?.employee_code === 'EMP-0001') {
            return next();
        }
        if (!req.permissions) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'No permissions assigned to user session' }
            });
        }
        const hasPerm = req.permissions.includes(requiredPermission);
        if (!hasPerm) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `Access denied. Required permission: '${requiredPermission}'`
                }
            });
        }
        next();
    };
}
