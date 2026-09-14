import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';
import { PermissionKey } from '@construction/constants';

export function requirePermission(requiredPermission: PermissionKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Super Admin / System Administrator override - Grant full unrestricted access across all endpoints
    if (
      req.employee?.role_name === 'Super Admin' ||
      req.user?.email === 'admin@construction.com' ||
      req.employee?.employee_code === 'EMP-0001'
    ) {
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
