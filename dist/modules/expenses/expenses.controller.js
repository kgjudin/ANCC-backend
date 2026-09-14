"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpenses = getExpenses;
exports.createExpense = createExpense;
const db_js_1 = require("../../config/db.js");
const validation_1 = require("@construction/validation");
const audit_service_js_1 = require("../../services/audit.service.js");
const constants_1 = require("@construction/constants");
async function getExpenses(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id;
        const { category, supplier_id, start_date, end_date, page = 1, limit = 50 } = authReq.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = `WHERE ex.company_id = $1`;
        const params = [companyId];
        if (category) {
            params.push(category);
            whereClause += ` AND ex.category = $${params.length}`;
        }
        if (supplier_id) {
            params.push(supplier_id);
            whereClause += ` AND ex.supplier_id = $${params.length}`;
        }
        if (start_date && end_date) {
            params.push(start_date, end_date);
            whereClause += ` AND ex.date >= $${params.length - 1} AND ex.date <= $${params.length}`;
        }
        const countRows = await (0, db_js_1.query)(`SELECT COUNT(*) as total FROM expenses ex ${whereClause}`, params);
        const total = Number(countRows[0].total);
        params.push(Number(limit), offset);
        const expenses = await (0, db_js_1.query)(`SELECT ex.*, s.company_name as supplier_name, p.purchase_number, e.full_name as created_by_name
       FROM expenses ex
       LEFT JOIN suppliers s ON ex.supplier_id = s.id
       LEFT JOIN purchases p ON ex.purchase_id = p.id
       JOIN employees e ON ex.created_by = e.id
       ${whereClause}
       ORDER BY ex.date DESC, ex.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return res.json({
            success: true,
            data: {
                items: expenses,
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
async function createExpense(req, res, next) {
    const authReq = req;
    try {
        const data = validation_1.ExpenseSchema.parse(authReq.body);
        const companyId = authReq.user?.company_id;
        const actorEmployeeId = authReq.employee?.id;
        const result = await (0, db_js_1.query)(`INSERT INTO expenses (
        company_id, category, amount, date, supplier_id, purchase_id, description, receipt_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`, [
            companyId,
            data.category,
            data.amount,
            data.date,
            data.supplier_id && String(data.supplier_id).trim() !== '' ? data.supplier_id : null,
            data.purchase_id && String(data.purchase_id).trim() !== '' ? data.purchase_id : null,
            data.description,
            data.receipt_url && String(data.receipt_url).trim() !== '' ? data.receipt_url : null,
            actorEmployeeId
        ]);
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'EXPENSE_CREATED',
            module: constants_1.AUDIT_MODULES.EXPENSE,
            entityType: 'Expense',
            entityId: result[0].id,
            changeMetadata: { category: data.category, amount: data.amount, date: data.date }
        });
        return res.status(201).json({
            success: true,
            message: 'Expense recorded successfully',
            data: result[0]
        });
    }
    catch (error) {
        next(error);
    }
}
