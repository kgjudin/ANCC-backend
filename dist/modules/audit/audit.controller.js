"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = getAuditLogs;
const db_js_1 = require("../../config/db.js");
async function getAuditLogs(req, res, next) {
    const authReq = req;
    try {
        const { module: mod, actor_employee_id, entity_type, start_date, end_date, page = 1, limit = 50 } = authReq.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = `WHERE 1=1`;
        const params = [];
        if (mod) {
            params.push(mod);
            whereClause += ` AND al.module = $${params.length}`;
        }
        if (actor_employee_id) {
            params.push(actor_employee_id);
            whereClause += ` AND al.actor_employee_id = $${params.length}`;
        }
        if (entity_type) {
            params.push(entity_type);
            whereClause += ` AND al.entity_type = $${params.length}`;
        }
        if (start_date && end_date) {
            params.push(start_date, end_date);
            whereClause += ` AND al.timestamp >= $${params.length - 1} AND al.timestamp <= $${params.length}`;
        }
        const countRows = await (0, db_js_1.query)(`SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`, params);
        const total = Number(countRows[0].total);
        params.push(Number(limit), offset);
        const logs = await (0, db_js_1.query)(`SELECT al.*, e.full_name as actor_employee_name, e.employee_code
       FROM audit_logs al
       LEFT JOIN employees e ON al.actor_employee_id = e.id
       ${whereClause}
       ORDER BY al.timestamp DESC
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
