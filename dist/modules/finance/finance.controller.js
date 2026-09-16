"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFinancialDocuments = getFinancialDocuments;
exports.createFinancialDocument = createFinancialDocument;
exports.updateFinancialDocStatus = updateFinancialDocStatus;
exports.getFinanceSummary = getFinanceSummary;
const crypto_1 = __importDefault(require("crypto"));
const db_js_1 = require("../../config/db.js");
const validation_1 = require("@construction/validation");
const audit_service_js_1 = require("../../services/audit.service.js");
const constants_1 = require("@construction/constants");
async function getFinancialDocuments(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const { site_id, status, start_date, end_date, search } = authReq.query;
        let whereClause = `WHERE (fd.company_id = $1 OR fd.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`;
        const params = [companyId];
        if (site_id) {
            params.push(site_id);
            whereClause += ` AND fd.site_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            whereClause += ` AND fd.status = $${params.length}`;
        }
        if (start_date && end_date) {
            params.push(start_date, end_date);
            whereClause += ` AND (fd.date >= $${params.length - 1} AND fd.date <= $${params.length})`;
        }
        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (fd.invoice_no ILIKE $${params.length} OR fd.vendor_name ILIKE $${params.length} OR st.name ILIKE $${params.length})`;
        }
        const docs = await (0, db_js_1.query)(`SELECT fd.*, st.name as site_name, e.full_name as created_by_name, app.full_name as approved_by_name
       FROM financial_documents fd
       LEFT JOIN sites st ON fd.site_id = st.id
       LEFT JOIN employees e ON fd.created_by = e.id
       LEFT JOIN employees app ON fd.approved_by = app.id
       ${whereClause}
       ORDER BY fd.date DESC, fd.created_at DESC`, params);
        return res.json({
            success: true,
            data: {
                items: docs || [],
                total: docs ? docs.length : 0
            }
        });
    }
    catch (error) {
        next(error);
    }
}
async function createFinancialDocument(req, res, next) {
    const authReq = req;
    try {
        const data = validation_1.FinancialDocumentSchema.parse(authReq.body);
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const actorEmployeeId = authReq.employee?.id || authReq.user?.id || '50000000-0000-0000-0000-000000000001';
        // Recalculate line totals and grand total
        const computedItems = (data.items || []).map((item) => ({
            description: item.description,
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            amount: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
        }));
        const calculatedSubtotal = computedItems.reduce((sum, item) => sum + item.amount, 0);
        const calculatedTotal = calculatedSubtotal + (Number(data.tax) || 0) - (Number(data.discount) || 0);
        const docId = crypto_1.default.randomUUID();
        const inserted = await (0, db_js_1.query)(`INSERT INTO financial_documents (
        id, invoice_no, company_id, site_id, vendor_name, date, items, subtotal, tax, discount, total, status, admin_remarks, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`, [
            docId,
            data.invoice_no,
            companyId,
            data.site_id,
            data.vendor_name,
            data.date,
            JSON.stringify(computedItems),
            calculatedSubtotal,
            data.tax || 0,
            data.discount || 0,
            calculatedTotal > 0 ? calculatedTotal : (data.total || 0),
            data.status || 'Pending',
            data.admin_remarks || null,
            actorEmployeeId
        ]);
        // Automatically record an expense entry for accounting integration!
        await (0, db_js_1.query)(`INSERT INTO expenses (
        id, company_id, category, amount, date, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            crypto_1.default.randomUUID(),
            companyId,
            'Material',
            calculatedTotal > 0 ? calculatedTotal : (data.total || 0),
            data.date,
            `[${data.invoice_no}] Vendor: ${data.vendor_name} - ${computedItems.map(i => i.description).join(', ')}`,
            actorEmployeeId
        ]);
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'FINANCIAL_DOC_CREATED',
            module: constants_1.AUDIT_MODULES.EMPLOYEE,
            entityType: 'FinancialDocument',
            entityId: docId,
            changeMetadata: { invoice_no: data.invoice_no, vendor_name: data.vendor_name, total: calculatedTotal }
        });
        return res.status(201).json({
            success: true,
            message: 'Financial document created successfully',
            data: inserted[0]
        });
    }
    catch (error) {
        next(error);
    }
}
async function updateFinancialDocStatus(req, res, next) {
    const authReq = req;
    try {
        const { id } = authReq.params;
        const { status, admin_remarks } = req.body;
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const actorEmployeeId = authReq.employee?.id || authReq.user?.id || '50000000-0000-0000-0000-000000000001';
        // Validation rule: Reject requires non-empty admin_remarks!
        if (status === 'Rejected' && (!admin_remarks || String(admin_remarks).trim() === '')) {
            return res.status(400).json({
                success: false,
                error: { code: 'REMARK_REQUIRED', message: 'Review remark or rejection reason is required when rejecting a bill.' }
            });
        }
        const updated = await (0, db_js_1.query)(`UPDATE financial_documents SET
        status = $1,
        admin_remarks = COALESCE($2, admin_remarks),
        approved_by = CASE WHEN $1 IN ('Approved', 'Rejected') THEN $3 ELSE approved_by END,
        updated_at = NOW()
       WHERE id = $4 AND (company_id = $5 OR company_id IS NULL OR $5 = '00000000-0000-0000-0000-000000000001')
       RETURNING *`, [status, admin_remarks || null, actorEmployeeId, id, companyId]);
        if (!updated || updated.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
        }
        return res.json({
            success: true,
            message: `Bill status updated to ${status}`,
            data: updated[0]
        });
    }
    catch (error) {
        next(error);
    }
}
async function getFinanceSummary(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const docs = await (0, db_js_1.query)(`SELECT fd.*, st.name as site_name FROM financial_documents fd LEFT JOIN sites st ON fd.site_id = st.id WHERE (fd.company_id = $1 OR fd.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`, [companyId]);
        const totalExpenses = (docs || []).reduce((acc, d) => acc + (Number(d.total || d.total_amount) || 0), 0);
        const pendingDocs = (docs || []).filter((d) => d.status === 'Pending' || d.status === 'Submitted').length;
        const approvedDocs = (docs || []).filter((d) => d.status === 'Approved').length;
        const rejectedDocs = (docs || []).filter((d) => d.status === 'Rejected').length;
        return res.json({
            success: true,
            data: {
                totalExpenses,
                pendingDocs,
                approvedDocs,
                rejectedDocs,
                totalDocsCount: docs ? docs.length : 0
            }
        });
    }
    catch (error) {
        next(error);
    }
}
