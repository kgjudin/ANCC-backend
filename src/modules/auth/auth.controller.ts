import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../../config/db.js';
import { ENV } from '../../config/env.js';
import { LoginSchema } from '@construction/validation';
import { logAudit } from '../../services/audit.service.js';
import { AUDIT_MODULES } from '@construction/constants';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    // Query user & employee profile
    const userRows = await query(
      `SELECT u.id as user_id, u.email, u.company_id, u.status, e.id as employee_id, e.full_name, e.status as emp_status
       FROM users u
       JOIN employees e ON e.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

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
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        companyId: user.company_id
      },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log login audit
    await logAudit({
      actorUserId: user.user_id,
      actorEmployeeId: user.employee_id,
      action: 'LOGIN',
      module: AUDIT_MODULES.AUTH,
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
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user || !authReq.employee) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    // Get User Role details
    let role = null;
    try {
      const roleRows = await query(
        `SELECT r.id, r.name, r.description, r.is_system
         FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1`,
        [authReq.user.id]
      );
      if (roleRows && roleRows.length > 0) {
        role = roleRows[0];
      }
    } catch (err) {
      // Fallback
    }

    if (!role && authReq.employee) {
      const empRoleName = (authReq.employee as any).role_name || 'Super Admin';
      const empRoleId = (authReq.employee as any).role_id || '10000000-0000-0000-0000-000000000001';
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
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    if (authReq.employee) {
      await logAudit({
        actorUserId: authReq.user?.id,
        actorEmployeeId: authReq.employee.id,
        action: 'LOGOUT',
        module: AUDIT_MODULES.AUTH,
        entityType: 'User',
        entityId: authReq.user?.id
      });
    }

    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
}
