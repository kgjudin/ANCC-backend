"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendance = getAttendance;
exports.recordAttendance = recordAttendance;
const db_js_1 = require("../../config/db.js");
const validation_1 = require("@construction/validation");
const audit_service_js_1 = require("../../services/audit.service.js");
const constants_1 = require("@construction/constants");
async function getAttendance(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id;
        const { employee_id, date, start_date, end_date, page = 1, limit = 50 } = authReq.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = `WHERE e.company_id = $1`;
        const params = [companyId];
        if (employee_id) {
            params.push(employee_id);
            whereClause += ` AND a.employee_id = $${params.length}`;
        }
        if (date) {
            params.push(date);
            whereClause += ` AND a.date = $${params.length}`;
        }
        else if (start_date && end_date) {
            params.push(start_date, end_date);
            whereClause += ` AND a.date >= $${params.length - 1} AND a.date <= $${params.length}`;
        }
        const countRows = await (0, db_js_1.query)(`SELECT COUNT(*) as total FROM attendance a JOIN employees e ON a.employee_id = e.id ${whereClause}`, params);
        const total = Number(countRows[0].total);
        params.push(Number(limit), offset);
        const logs = await (0, db_js_1.query)(`SELECT a.*, e.full_name as employee_name, e.employee_code, d.name as department_name
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       ${whereClause}
       ORDER BY a.date DESC, e.full_name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return res.json({
            success: true,
            data: {
                items: logs,
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
async function recordAttendance(req, res, next) {
    const authReq = req;
    try {
        const data = validation_1.RecordAttendanceSchema.parse(authReq.body);
        const actorEmployeeId = authReq.employee?.id;
        const employeeId = data.employee_id || actorEmployeeId;
        let totalHours = null;
        if (data.check_in && data.check_out) {
            const inTime = new Date(`1970-01-01T${data.check_in}`);
            const outTime = new Date(`1970-01-01T${data.check_out}`);
            const diffMs = outTime.getTime() - inTime.getTime();
            if (diffMs > 0) {
                totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
            }
        }
        const result = await (0, db_js_1.query)(`INSERT INTO attendance (employee_id, date, check_in, check_out, total_hours, status, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT (employee_id, date) DO UPDATE SET
         check_in = EXCLUDED.check_in,
         check_out = EXCLUDED.check_out,
         total_hours = EXCLUDED.total_hours,
         status = EXCLUDED.status,
         notes = EXCLUDED.notes,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`, [
            employeeId,
            data.date,
            data.check_in || null,
            data.check_out || null,
            totalHours,
            data.status,
            data.notes || null,
            actorEmployeeId
        ]);
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'ATTENDANCE_RECORDED',
            module: constants_1.AUDIT_MODULES.ATTENDANCE,
            entityType: 'Attendance',
            entityId: result[0].id,
            changeMetadata: { target_employee_id: employeeId, date: data.date, status: data.status }
        });
        return res.json({
            success: true,
            message: 'Attendance recorded successfully',
            data: result[0]
        });
    }
    catch (error) {
        next(error);
    }
}
