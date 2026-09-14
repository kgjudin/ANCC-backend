import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { CreateEmployeeSchema, UpdateEmployeeSchema } from '@construction/validation';
import { logAudit } from '../../services/audit.service.js';
import { AUDIT_MODULES } from '@construction/constants';
import bcrypt from 'bcryptjs';

export async function getEmployees(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const { search, department_id, status, page = 1, limit = 20 } = authReq.query;

    const offset = (Number(page) - 1) * Number(limit);
    let whereClause = `WHERE (e.company_id = $1 OR e.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`;
    const params: any[] = [companyId];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (e.full_name ILIKE $${params.length} OR e.employee_code ILIKE $${params.length} OR e.email ILIKE $${params.length} OR e.phone ILIKE $${params.length})`;
    }

    if (department_id) {
      params.push(department_id);
      whereClause += ` AND e.department_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      whereClause += ` AND e.status = $${params.length}`;
    }

    const countRows = await query(`SELECT COUNT(*) as total FROM employees e ${whereClause}`, params);
    const total = Number(countRows[0].total);

    params.push(Number(limit), offset);
    const employees = await query(
      `SELECT e.*, d.name as department_name, des.name as designation_name, r.id as role_id, r.name as role_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations des ON e.designation_id = des.id
       LEFT JOIN user_roles ur ON ur.user_id = e.user_id
       LEFT JOIN roles r ON r.id = ur.role_id
       ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      success: true,
      data: {
        items: employees,
        total,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeById(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const companyId = authReq.user?.company_id;

    const rows = await query(
      `SELECT e.*, d.name as department_name, des.name as designation_name, r.id as role_id, r.name as role_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations des ON e.designation_id = des.id
       LEFT JOIN user_roles ur ON ur.user_id = e.user_id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE e.id = $1 AND e.company_id = $2`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
}

export async function createEmployee(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = CreateEmployeeSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id!;
    const actorEmployeeId = authReq.employee?.id!;

    // Generate unique employee code EMP-XXXX
    const countRes = await query(`SELECT COUNT(*) as cnt FROM employees WHERE company_id = $1`, [companyId]);
    const empSeq = Number(countRes[0].cnt) + 1;
    const employeeCode = `EMP-${String(empSeq).padStart(4, '0')}`;

    // Generate User ID & Employee ID
    const userId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();

    // Insert User
    await query(
      `INSERT INTO users (id, email, company_id, status) VALUES ($1, $2, $3, 'Active')`,
      [userId, data.email, companyId]
    );

    // Insert User Role
    await query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [userId, data.role_id]
    );

    // Insert Employee
    const empRows = await query(
      `INSERT INTO employees (
        id, employee_code, user_id, company_id, full_name, phone, email,
        department_id, designation_id, joining_date, status, profile_photo_url, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Active', $11, $12, $12)
      RETURNING *`,
      [
        employeeId,
        employeeCode,
        userId,
        companyId,
        data.full_name,
        data.phone,
        data.email,
        data.department_id || null,
        data.designation_id || null,
        data.joining_date,
        data.profile_photo_url || null,
        actorEmployeeId
      ]
    );

    // Auto-allocate initial leave balances for current year
    const leaveTypes = await query(`SELECT * FROM leave_types WHERE company_id = $1 AND status = 'Active'`, [companyId]);
    const currentYear = new Date(data.joining_date).getFullYear();

    for (const lt of leaveTypes) {
      await query(
        `INSERT INTO employee_leave_balances (employee_id, leave_type_id, year, allocated_days, used_days, remaining_days)
         VALUES ($1, $2, $3, $4, 0, $4)
         ON CONFLICT DO NOTHING`,
        [employeeId, lt.id, currentYear, lt.allocated_days]
      );
    }

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'EMPLOYEE_CREATED',
      module: AUDIT_MODULES.EMPLOYEE,
      entityType: 'Employee',
      entityId: employeeId,
      changeMetadata: { employee_code: employeeCode, full_name: data.full_name, role_id: data.role_id }
    });

    return res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: empRows[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployee(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const data = UpdateEmployeeSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id!;
    const actorEmployeeId = authReq.employee?.id!;

    const existing = await query(`SELECT * FROM employees WHERE id = $1 AND company_id = $2`, [id, companyId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    }

    const currentEmp = existing[0];

    // Update Employee record
    const updated = await query(
      `UPDATE employees SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        department_id = COALESCE($3, department_id),
        designation_id = COALESCE($4, designation_id),
        status = COALESCE($5, status),
        profile_photo_url = COALESCE($6, profile_photo_url),
        updated_by = $7,
        updated_at = NOW()
       WHERE id = $8 AND company_id = $9
       RETURNING *`,
      [
        data.full_name || null,
        data.phone || null,
        data.department_id || null,
        data.designation_id || null,
        data.status || null,
        data.profile_photo_url || null,
        actorEmployeeId,
        id,
        companyId
      ]
    );

    // Update Role if provided
    if (data.role_id) {
      await query(`DELETE FROM user_roles WHERE user_id = $1`, [currentEmp.user_id]);
      await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [currentEmp.user_id, data.role_id]);
    }

    // Update User Status if employee status changed
    if (data.status) {
      await query(`UPDATE users SET status = $1 WHERE id = $2`, [data.status, currentEmp.user_id]);
    }

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: data.status === 'Inactive' ? 'EMPLOYEE_DEACTIVATED' : 'EMPLOYEE_UPDATED',
      module: AUDIT_MODULES.EMPLOYEE,
      entityType: 'Employee',
      entityId: id,
      changeMetadata: { previous: currentEmp, updated: data }
    });

    return res.json({
      success: true,
      message: 'Employee updated successfully',
      data: updated[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const { new_password } = authReq.body;
    const actorEmployeeId = authReq.employee?.id!;

    if (!new_password || new_password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters long' }
      });
    }

    const empRows = await query(`SELECT * FROM employees WHERE id = $1`, [id]);
    if (empRows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    }

    const emp = empRows[0];

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashedPassword, emp.user_id]);

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'EMPLOYEE_PASSWORD_RESET',
      module: AUDIT_MODULES.EMPLOYEE,
      entityType: 'Employee',
      entityId: id,
      changeMetadata: { employee_code: emp.employee_code, full_name: emp.full_name }
    });

    return res.json({
      success: true,
      message: `Password reset successfully for ${emp.full_name}`
    });
  } catch (error) {
    next(error);
  }
}
