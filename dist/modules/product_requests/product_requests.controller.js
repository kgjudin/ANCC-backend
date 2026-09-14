"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductRequests = getProductRequests;
exports.createProductRequest = createProductRequest;
exports.updateProductRequestStatus = updateProductRequestStatus;
const db_js_1 = require("../../config/db.js");
const validation_1 = require("@construction/validation");
const audit_service_js_1 = require("../../services/audit.service.js");
const constants_1 = require("@construction/constants");
async function getProductRequests(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const { site_id, status, priority, search } = authReq.query;
        let whereClause = `WHERE (prq.company_id = $1 OR prq.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`;
        const params = [companyId];
        if (site_id) {
            params.push(site_id);
            whereClause += ` AND prq.site_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            whereClause += ` AND prq.status = $${params.length}`;
        }
        if (priority) {
            params.push(priority);
            whereClause += ` AND prq.priority = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (prq.request_code ILIKE $${params.length} OR prq.product_name ILIKE $${params.length} OR st.name ILIKE $${params.length})`;
        }
        const requests = await (0, db_js_1.query)(`SELECT prq.*, st.name as site_name, e.full_name as requested_by_name, rev.full_name as reviewed_by_name
       FROM product_requests prq
       LEFT JOIN sites st ON prq.site_id = st.id
       LEFT JOIN employees e ON prq.requested_by = e.id
       LEFT JOIN employees rev ON prq.reviewed_by = rev.id
       ${whereClause}
       ORDER BY prq.created_at DESC`, params);
        return res.json({
            success: true,
            data: {
                items: requests || [],
                total: requests ? requests.length : 0
            }
        });
    }
    catch (error) {
        next(error);
    }
}
async function createProductRequest(req, res, next) {
    const authReq = req;
    try {
        const data = validation_1.ProductRequestSchema.parse(authReq.body);
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const actorEmployeeId = authReq.employee?.id;
        // Sequence for REQ-XXXX
        const countRes = await (0, db_js_1.query)(`SELECT COUNT(*) as cnt FROM product_requests WHERE (company_id = $1 OR company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`, [companyId]);
        const cntVal = Number(countRes[0]?.cnt ?? countRes[0]?.total ?? countRes[0]?.count ?? 0);
        const seq = isNaN(cntVal) || cntVal < 0 ? 1 : cntVal + 1;
        const reqCode = `REQ-${String(seq).padStart(4, '0')}`;
        const reqId = crypto.randomUUID();
        const inserted = await (0, db_js_1.query)(`INSERT INTO product_requests (
        id, request_code, company_id, site_id, product_id, product_name, category, quantity, unit, required_date, priority, reason, attachment_url, requested_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $18, $19)
      RETURNING *`, [
            reqId,
            reqCode,
            companyId,
            data.site_id,
            data.product_id || null,
            data.product_name,
            data.category,
            data.quantity,
            data.unit,
            data.required_date,
            data.priority || 'Medium',
            data.reason || null,
            data.attachment_url || null,
            actorEmployeeId,
            'Pending'
        ]);
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'PRODUCT_REQUEST_CREATED',
            module: constants_1.AUDIT_MODULES.EMPLOYEE,
            entityType: 'ProductRequest',
            entityId: reqId,
            changeMetadata: { request_code: reqCode, product_name: data.product_name, quantity: data.quantity }
        });
        return res.status(201).json({
            success: true,
            message: 'Product request submitted successfully',
            data: inserted[0]
        });
    }
    catch (error) {
        next(error);
    }
}
async function updateProductRequestStatus(req, res, next) {
    const authReq = req;
    try {
        const { id } = authReq.params;
        const { status, notes } = req.body;
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const actorEmployeeId = authReq.employee?.id;
        const reqRows = await (0, db_js_1.query)(`SELECT * FROM product_requests WHERE id = $1 AND (company_id = $2 OR company_id IS NULL OR $2 = '00000000-0000-0000-0000-000000000001')`, [id, companyId]);
        if (!reqRows || reqRows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product request not found' } });
        }
        const prq = reqRows[0];
        const updated = await (0, db_js_1.query)(`UPDATE product_requests SET
        status = $1,
        reviewed_by = $2,
        notes = COALESCE($3, notes),
        updated_at = NOW()
       WHERE id = $4 AND (company_id = $5 OR company_id IS NULL OR $5 = '00000000-0000-0000-0000-000000000001')
       RETURNING *`, [status, actorEmployeeId, notes || null, id, companyId]);
        // Connected Module Flow: When status changes to Received or Completed, automatically increase site inventory!
        if ((status === 'Received' || status === 'Completed') && prq.product_id) {
            // Upsert inventory
            const existingInv = await (0, db_js_1.query)(`SELECT * FROM inventory WHERE site_id = $1 AND product_id = $2`, [prq.site_id, prq.product_id]);
            if (existingInv && existingInv.length > 0) {
                const inv = existingInv[0];
                const newReceived = Number(inv.received_qty || 0) + Number(prq.quantity);
                const newBalance = Number(inv.opening_stock || 0) + newReceived + Number(inv.transferred_in_qty || 0) - Number(inv.used_qty || 0) - Number(inv.damaged_qty || 0) - Number(inv.unwanted_qty || 0) - Number(inv.transferred_out_qty || 0);
                await (0, db_js_1.query)(`UPDATE inventory SET received_qty = $1, current_balance = $2, updated_at = NOW() WHERE id = $3`, [newReceived, newBalance, inv.id]);
            }
            else {
                await (0, db_js_1.query)(`INSERT INTO inventory (id, company_id, site_id, product_id, opening_stock, received_qty, current_balance, unit)
           VALUES ($1, $2, $3, $4, 0, $5, $5, $6)`, [crypto.randomUUID(), companyId, prq.site_id, prq.product_id, prq.quantity, prq.unit]);
            }
            // Record immutable inventory transaction log
            await (0, db_js_1.query)(`INSERT INTO inventory_transactions (
          id, company_id, site_id, product_id, quantity, unit, transaction_type, reference_id, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
                crypto.randomUUID(),
                companyId,
                prq.site_id,
                prq.product_id,
                prq.quantity,
                prq.unit,
                'Material Received',
                id,
                `Received from Product Request ${prq.request_code}`,
                actorEmployeeId
            ]);
        }
        return res.json({
            success: true,
            message: `Product request status updated to ${status}`,
            data: updated[0]
        });
    }
    catch (error) {
        next(error);
    }
}
