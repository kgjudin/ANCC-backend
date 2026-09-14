"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPurchaseSummaryReport = getPurchaseSummaryReport;
exports.getExpenseSummaryReport = getExpenseSummaryReport;
const db_js_1 = require("../../config/db.js");
async function getPurchaseSummaryReport(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id;
        const { start_date, end_date } = authReq.query;
        let dateFilter = '';
        const params = [companyId];
        if (start_date && end_date) {
            params.push(start_date, end_date);
            dateFilter = ` AND purchase_date >= $2 AND purchase_date <= $3`;
        }
        const summary = await (0, db_js_1.query)(`SELECT 
        COUNT(id) as total_purchases_count,
        COALESCE(SUM(grand_total), 0) as total_grand_amount,
        COALESCE(SUM(paid_amount), 0) as total_paid_amount,
        COALESCE(SUM(outstanding_amount), 0) as total_outstanding_amount
       FROM purchases
       WHERE company_id = $1 ${dateFilter}`, params);
        const supplierWise = await (0, db_js_1.query)(`SELECT s.company_name, COUNT(p.id) as order_count, SUM(p.grand_total) as grand_total, SUM(p.paid_amount) as paid_amount, SUM(p.outstanding_amount) as outstanding_amount
       FROM purchases p
       JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.company_id = $1 ${dateFilter}
       GROUP BY s.id, s.company_name
       ORDER BY grand_total DESC`, params);
        return res.json({
            success: true,
            data: {
                overall: summary[0],
                supplier_breakdown: supplierWise
            }
        });
    }
    catch (error) {
        next(error);
    }
}
async function getExpenseSummaryReport(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id;
        const categoryBreakdown = await (0, db_js_1.query)(`SELECT category, COUNT(id) as count, SUM(amount) as total_amount
       FROM expenses
       WHERE company_id = $1
       GROUP BY category
       ORDER BY total_amount DESC`, [companyId]);
        return res.json({
            success: true,
            data: {
                category_breakdown: categoryBreakdown
            }
        });
    }
    catch (error) {
        next(error);
    }
}
