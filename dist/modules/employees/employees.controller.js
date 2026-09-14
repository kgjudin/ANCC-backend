"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployees = getEmployees;
exports.getEmployeeById = getEmployeeById;
exports.createEmployee = createEmployee;
exports.updateEmployee = updateEmployee;
exports.resetPassword = resetPassword;
const db_js_1 = require("../../config/db.js");
const validation_1 = require("@construction/validation");
const audit_service_js_1 = require("../../services/audit.service.js");
const constants_1 = require("@construction/constants");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function getEmployees(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const { search, department_id, status, page = 1, limit = 20 } = authReq.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = `WHERE (e.company_id = $1 OR e.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`;
        const params = [companyId];
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
        const countRows = await (0, db_js_1.query)(`SELECT COUNT(*) as total FROM employees e ${whereClause}`, params);
        const total = Number(countRows[0].total);
        params.push(Number(limit), offset);
        const employees = await (0, db_js_1.query)(`SELECT e.*, d.name as department_name, des.name as designation_name, r.id as role_id, r.name as role_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations des ON e.designation_id = des.id
       LEFT JOIN user_roles ur ON ur.user_id = e.user_id
       LEFT JOIN roles r ON r.id = ur.role_id
       ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
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
    }
    catch (error) {
        next(error);
    }
}
async function getEmployeeById(req, res, next) {
    const authReq = req;
    try {
        const { id } = authReq.params;
        const companyId = authReq.user?.company_id;
        const rows = await (0, db_js_1.query)(`SELECT e.*, d.name as department_name, des.name as designation_name, r.id as role_id, r.name as role_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations des ON e.designation_id = des.id
       LEFT JOIN user_roles ur ON ur.user_id = e.user_id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE e.id = $1 AND e.company_id = $2`, [id, companyId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } });
        }
        return res.json({ success: true, data: rows[0] });
    }
    catch (error) {
        next(error);
    }
}
async function createEmployee(req, res, next) {
    const authReq = req;
    try {
        const data = validation_1.CreateEmployeeSchema.parse(authReq.body);
        const companyId = authReq.user?.company_id;
        const actorEmployeeId = authReq.employee?.id;
        // Generate unique employee code EMP-XXXX
        const countRes = await (0, db_js_1.query)(`SELECT COUNT(*) as cnt FROM employees WHERE company_id = $1`, [companyId]);
        const empSeq = Number(countRes[0].cnt) + 1;
        const employeeCode = `EMP-${String(empSeq).padStart(4, '0')}`;
        // Generate User ID & Employee ID
        const userId = crypto.randomUUID();
        const employeeId = crypto.randomUUID();
        // Insert User
        await (0, db_js_1.query)(`INSERT INTO users (id, email, company_id, status) VALUES ($1, $2, $3, 'Active')`, [userId, data.email, companyId]);
        // Insert User Role
        await (0, db_js_1.query)(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [userId, data.role_id]);
        // Insert Employee
        const empRows = await (0, db_js_1.query)(`INSERT INTO employees (
        id, employee_code, user_id, company_id, full_name, phone, email,
        department_id, designation_id, joining_date, status, profile_photo_url, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Active', $11, $12, $12)
      RETURNING *`, [
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
        ]);
        // Auto-allocate initial leave balances for current year
        const leaveTypes = await (0, db_js_1.query)(`SELECT * FROM leave_types WHERE company_id = $1 AND status = 'Active'`, [companyId]);
        const currentYear = new Date(data.joining_date).getFullYear();
        for (const lt of leaveTypes) {
            await (0, db_js_1.query)(`INSERT INTO employee_leave_balances (employee_id, leave_type_id, year, allocated_days, used_days, remaining_days)
         VALUES ($1, $2, $3, $4, 0, $4)
         ON CONFLICT DO NOTHING`, [employeeId, lt.id, currentYear, lt.allocated_days]);
        }
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'EMPLOYEE_CREATED',
            module: constants_1.AUDIT_MODULES.EMPLOYEE,
            entityType: 'Employee',
            entityId: employeeId,
            changeMetadata: { employee_code: employeeCode, full_name: data.full_name, role_id: data.role_id }
        });
        return res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: empRows[0]
        });
    }
    catch (error) {
        next(error);
    }
}
async function updateEmployee(req, res, next) {
    const authReq = req;
    try {
        const { id } = authReq.params;
        const data = validation_1.UpdateEmployeeSchema.parse(authReq.body);
        const companyId = authReq.user?.company_id;
        const actorEmployeeId = authReq.employee?.id;
        const existing = await (0, db_js_1.query)(`SELECT * FROM employees WHERE id = $1 AND company_id = $2`, [id, companyId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } });
        }
        const currentEmp = existing[0];
        // Update Employee record
        const updated = await (0, db_js_1.query)(`UPDATE employees SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        department_id = COALESCE($3, department_id),
        designation_id = COALESCE($4, designation_id),
        status = COALESCE($5, status),
        profile_photo_url = COALESCE($6, profile_photo_url),
        updated_by = $7,
        updated_at = NOW()
       WHERE id = $8 AND company_id = $9
       RETURNING *`, [
            data.full_name || null,
            data.phone || null,
            data.department_id || null,
            data.designation_id || null,
            data.status || null,
            data.profile_photo_url || null,
            actorEmployeeId,
            id,
            companyId
        ]);
        // Update Role if provided
        if (data.role_id) {
            await (0, db_js_1.query)(`DELETE FROM user_roles WHERE user_id = $1`, [currentEmp.user_id]);
            await (0, db_js_1.query)(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [currentEmp.user_id, data.role_id]);
        }
        // Update User Status if employee status changed
        if (data.status) {
            await (0, db_js_1.query)(`UPDATE users SET status = $1 WHERE id = $2`, [data.status, currentEmp.user_id]);
        }
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: data.status === 'Inactive' ? 'EMPLOYEE_DEACTIVATED' : 'EMPLOYEE_UPDATED',
            module: constants_1.AUDIT_MODULES.EMPLOYEE,
            entityType: 'Employee',
            entityId: id,
            changeMetadata: { previous: currentEmp, updated: data }
        });
        return res.json({
            success: true,
            message: 'Employee updated successfully',
            data: updated[0]
        });
    }
    catch (error) {
        next(error);
    }
}
async function resetPassword(req, res, next) {
    const authReq = req;
    try {
        const { id } = authReq.params;
        const { new_password } = authReq.body;
        const actorEmployeeId = authReq.employee?.id;
        if (!new_password || new_password.trim().length < 6) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters long' }
            });
        }
        const empRows = await (0, db_js_1.query)(`SELECT * FROM employees WHERE id = $1`, [id]);
        if (empRows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } });
        }
        const emp = empRows[0];
        const hashedPassword = await bcryptjs_1.default.hash(new_password, 10);
        await (0, db_js_1.query)(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashedPassword, emp.user_id]);
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'EMPLOYEE_PASSWORD_RESET',
            module: constants_1.AUDIT_MODULES.EMPLOYEE,
            entityType: 'Employee',
            entityId: id,
            changeMetadata: { employee_code: emp.employee_code, full_name: emp.full_name }
        });
        return res.json({
            success: true,
            message: `Password reset successfully for ${emp.full_name}`
        });
    }
    catch (error) {
        next(error);
    }
}
