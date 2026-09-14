import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { query, memoryStore } from '../config/db.js';
import { ALL_PERMISSIONS } from '@construction/constants';
import { Employee } from '@construction/shared-types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    company_id: string;
  };
  employee?: Employee;
  permissions?: string[];
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authReq = req as AuthenticatedRequest;
  try {
    const authHeader = authReq.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication token required' }
      });
    }

    // Verify JWT Token
    let decoded: { userId: string; email: string; companyId: string };
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired authentication token' }
      });
    }

    const userId = decoded.userId;
    const userEmail = (decoded.email || '').toLowerCase();
    const companyId = decoded.companyId || '00000000-0000-0000-0000-000000000001';

    // Fetch User & Employee details
    let employee: any = null;

    try {
      const empRows = await query(
        `SELECT e.*, d.name as department_name, des.name as designation_name, 
                ur.role_id, r.name as role_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN designations des ON e.designation_id = des.id
         LEFT JOIN user_roles ur ON ur.user_id = e.user_id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE e.user_id = $1 AND e.status = 'Active'`,
        [userId]
      );
      if (empRows && empRows.length > 0) {
        employee = empRows[0];
      }
    } catch (err) {
      // Fallback
    }

    // Fallback: Check memoryStore.employees
    if (!employee) {
      const memEmp = memoryStore.employees.find(
        (e) => e.user_id === userId || e.email.toLowerCase() === userEmail
      );
      if (memEmp) {
        employee = { ...memEmp };
      }
    }

    // Fallback: Default Super Admin Account if admin@construction.com
    if (!employee && userEmail === 'admin@construction.com') {
      employee = {
        id: '50000000-0000-0000-0000-000000000001',
        employee_code: 'EMP-0001',
        user_id: userId,
        company_id: companyId,
        full_name: 'System Administrator',
        email: userEmail,
        phone: '+919876543210',
        role_id: '10000000-0000-0000-0000-000000000001',
        role_name: 'Super Admin',
        status: 'Active'
      };
    }

    if (!employee) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Active employee profile not found' }
      });
    }

    // Determine Role Name & Role ID
    const roleName = employee.role_name || (userEmail === 'admin@construction.com' ? 'Super Admin' : 'Employee');
    const roleId = employee.role_id || '10000000-0000-0000-0000-000000000004';
    employee.role_name = roleName;
    employee.role_id = roleId;

    // Resolve Permissions for Logged-In User
    let permissionKeys: string[] = [];

    if (roleName === 'Super Admin' || userEmail === 'admin@construction.com') {
      permissionKeys = ALL_PERMISSIONS as any;
    } else {
      // 1. Try DB Query for role_permissions
      try {
        const permRows = await query(
          `SELECT DISTINCT p.key
           FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id
           JOIN user_roles ur ON ur.role_id = rp.role_id
           WHERE ur.user_id = $1`,
          [userId]
        );

        if (permRows && permRows.length > 0) {
          permissionKeys = permRows.map((r: any) => r.key);
        }
      } catch (err) {
        // Fallback
      }

      // 2. Memory Store Fallback
      if (permissionKeys.length === 0) {
        const memRole = memoryStore.roles.find(
          (r: any) => r.id === roleId || r.name === roleName
        );
        if (memRole && memRole.permissions) {
          permissionKeys = memRole.permissions.map((p: any) => (typeof p === 'string' ? p : p.key));
        }
      }

      // 3. System Standard Role Presets Fallback
      if (permissionKeys.length === 0) {
        if (roleName === 'HR Manager') {
          permissionKeys = ALL_PERMISSIONS.filter((k) =>
            ['employee', 'attendance', 'leave', 'holiday'].includes(k.split('.')[0])
          ) as any;
        } else if (roleName === 'Purchase Executive' || roleName === 'Purchase Officer') {
          permissionKeys = ALL_PERMISSIONS.filter((k) =>
            ['supplier', 'product', 'purchase', 'expense'].includes(k.split('.')[0])
          ) as any;
        } else {
          permissionKeys = ALL_PERMISSIONS.filter((k) =>
            ['attendance.view', 'leave.view', 'leave.request'].includes(k)
          ) as any;
        }
      }
    }

    authReq.user = {
      id: userId,
      email: userEmail,
      company_id: companyId
    };
    authReq.employee = employee;
    authReq.permissions = permissionKeys;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired authentication token' }
    });
  }
}
