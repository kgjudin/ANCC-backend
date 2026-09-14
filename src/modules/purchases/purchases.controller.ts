import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { PurchaseSchema, PaymentUpdateSchema } from '@construction/validation';
import { calculatePurchaseTotals } from '../../services/finance.service.js';
import { logAudit } from '../../services/audit.service.js';
import { AUDIT_MODULES } from '@construction/constants';

export async function getPurchases(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const { supplier_id, payment_status, start_date, end_date, search, page = 1, limit = 20 } = authReq.query;

    const offset = (Number(page) - 1) * Number(limit);
    let whereClause = `WHERE (p.company_id = $1 OR p.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`;
    const params: any[] = [companyId];

    if (supplier_id) {
      params.push(supplier_id);
      whereClause += ` AND p.supplier_id = $${params.length}`;
    }

    if (payment_status) {
      params.push(payment_status);
      whereClause += ` AND p.payment_status = $${params.length}`;
    }

    if (start_date && end_date) {
      params.push(start_date, end_date);
      whereClause += ` AND p.purchase_date >= $${params.length - 1} AND p.purchase_date <= $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (p.purchase_number ILIKE $${params.length} OR s.company_name ILIKE $${params.length} OR p.invoice_number ILIKE $${params.length})`;
    }

    const countRows = await query(
      `SELECT COUNT(*) as total FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || countRows[0]?.cnt || countRows[0]?.count || 0);

    params.push(Number(limit), offset);
    const purchases = await query(
      `SELECT p.*, 
              COALESCE(s.company_name, 'Direct Purchase') as supplier_name, 
              COALESCE(e.full_name, 'Admin') as created_by_name,
              st.name as site_name,
              st.site_code
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN employees e ON p.created_by = e.id
       LEFT JOIN sites st ON p.site_id = st.id
       ${whereClause}
       ORDER BY p.purchase_date DESC, p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      success: true,
      data: {
        items: purchases || [],
        total,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(total / (Number(limit) || 20))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPurchaseById(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const companyId = authReq.user?.company_id;

    const purchaseRows = await query(
      `SELECT p.*, s.company_name as supplier_name, s.contact_person, s.phone as supplier_phone, e.full_name as created_by_name
       FROM purchases p
       JOIN suppliers s ON p.supplier_id = s.id
       JOIN employees e ON p.created_by = e.id
       WHERE p.id = $1 AND p.company_id = $2`,
      [id, companyId]
    );

    if (purchaseRows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase not found' } });
    }

    const purchase = purchaseRows[0];

    const items = await query(
      `SELECT pi.*, pr.name as product_name, pr.product_code
       FROM purchase_items pi
       JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = $1`,
      [id]
    );

    const auditLogs = await query(
      `SELECT al.*, e.full_name as actor_employee_name
       FROM audit_logs al
       LEFT JOIN employees e ON al.actor_employee_id = e.id
       WHERE al.entity_type = 'Purchase' AND al.entity_id = $1
       ORDER BY al.timestamp DESC`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...purchase,
        items,
        audit_history: auditLogs
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createPurchase(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = PurchaseSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const actorEmployeeId = authReq.employee?.id!;

    let subtotal = 0;
    let grandTotal = Number(data.grand_total || 0);
    let itemsToSave: any[] = (data.items || []) as any[];

    if (itemsToSave.length > 0) {
      const calc = calculatePurchaseTotals({
        transport_cost: data.transport_cost,
        other_charges: data.other_charges,
        tax_amount: data.tax_amount,
        discount_amount: data.discount_amount,
        paid_amount: data.paid_amount,
        items: itemsToSave
      });
      subtotal = calc.subtotal;
      grandTotal = calc.grand_total;
      itemsToSave = calc.items;
    } else {
      subtotal = Math.max(0, grandTotal - data.transport_cost - data.other_charges - data.tax_amount + data.discount_amount);
    }

    const paidAmount = Number(data.paid_amount || 0);
    const outstandingAmount = Math.max(0, Number((grandTotal - paidAmount).toFixed(2)));
    let paymentStatus = 'Unpaid';
    if (paidAmount >= grandTotal && grandTotal > 0) paymentStatus = 'Paid';
    else if (paidAmount > 0) paymentStatus = 'Partially Paid';

    const countRes = await query(`SELECT COUNT(*) as cnt FROM purchases WHERE (company_id = $1 OR company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`, [companyId]);
    const cntVal = Number(countRes[0]?.cnt ?? countRes[0]?.total ?? countRes[0]?.count ?? 0);
    const seq = isNaN(cntVal) || cntVal < 0 ? 1 : cntVal + 1;
    const purchaseNumber = `PUR-${String(seq).padStart(5, '0')}`;

    const purchaseId = crypto.randomUUID();

    const headerResult = await query(
      `INSERT INTO purchases (
        id, purchase_number, company_id, supplier_id, site_id, purchase_date,
        subtotal, transport_cost, other_charges, tax_amount, discount_amount,
        grand_total, paid_amount, outstanding_amount, payment_status,
        invoice_number, invoice_document_url, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        purchaseId,
        purchaseNumber,
        companyId,
        data.supplier_id,
        data.site_id && String(data.site_id).trim() !== '' ? data.site_id : null,
        data.purchase_date,
        subtotal,
        data.transport_cost,
        data.other_charges,
        data.tax_amount,
        data.discount_amount,
        grandTotal,
        paidAmount,
        outstandingAmount,
        paymentStatus,
        data.invoice_number || null,
        data.invoice_document_url || null,
        data.notes || null,
        actorEmployeeId
      ]
    );

    for (const item of itemsToSave) {
      const lineTotal = Number(item.line_total || (item.quantity * item.unit_rate - (item.discount || 0) + (item.tax || 0)));
      await query(
        `INSERT INTO purchase_items (
          purchase_id, product_id, quantity, unit, unit_rate, discount, tax, line_total, brand, grade, quality_status, quality_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          purchaseId,
          item.product_id,
          item.quantity,
          item.unit,
          item.unit_rate,
          item.discount || 0,
          item.tax || 0,
          lineTotal,
          item.brand || null,
          item.grade || null,
          item.quality_status || 'Approved',
          item.quality_notes || null
        ]
      );
    }

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'PURCHASE_CREATED',
      module: AUDIT_MODULES.PURCHASE,
      entityType: 'Purchase',
      entityId: purchaseId,
      changeMetadata: {
        purchase_number: purchaseNumber,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount,
        item_count: itemsToSave.length
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Purchase recorded successfully',
      data: {
        ...headerResult[0],
        items: itemsToSave
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePurchasePayment(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const { paid_amount } = PaymentUpdateSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id!;
    const actorEmployeeId = authReq.employee?.id!;

    const existing = await query(`SELECT * FROM purchases WHERE id = $1 AND company_id = $2`, [id, companyId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase not found' } });
    }

    const purchase = existing[0];
    const grandTotal = Number(purchase.grand_total);

    if (paid_amount > grandTotal) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYMENT', message: `Paid amount (₹${paid_amount}) cannot exceed Grand Total (₹${grandTotal}).` }
      });
    }

    const outstanding = Number((grandTotal - paid_amount).toFixed(2));
    let status = 'Unpaid';
    if (paid_amount >= grandTotal) status = 'Paid';
    else if (paid_amount > 0) status = 'Partially Paid';

    const updated = await query(
      `UPDATE purchases SET
        paid_amount = $1,
        outstanding_amount = $2,
        payment_status = $3,
        updated_at = NOW()
       WHERE id = $4 AND (company_id = $5 OR company_id IS NULL OR $5 = '00000000-0000-0000-0000-000000000001')
       RETURNING *`,
      [paid_amount, outstanding, status, id, companyId]
    );

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'PAYMENT_UPDATED',
      module: AUDIT_MODULES.PURCHASE,
      entityType: 'Purchase',
      entityId: id,
      changeMetadata: { previous_paid: purchase.paid_amount, new_paid: paid_amount, outstanding }
    });

    return res.json({
      success: true,
      message: 'Purchase payment updated successfully',
      data: updated[0]
    });
  } catch (error) {
    next(error);
  }
}
