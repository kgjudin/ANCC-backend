import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { SupplierSchema } from '@construction/validation';
import { logAudit } from '../../services/audit.service.js';
import { AUDIT_MODULES } from '@construction/constants';

export async function getSuppliers(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id;
    const { search, page = 1, limit = 50 } = authReq.query;

    const offset = (Number(page) - 1) * Number(limit);
    let whereClause = `WHERE s.company_id = $1`;
    const params: any[] = [companyId];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (s.company_name ILIKE $${params.length} OR s.supplier_code ILIKE $${params.length} OR s.contact_person ILIKE $${params.length} OR s.phone ILIKE $${params.length} OR s.gst_number ILIKE $${params.length})`;
    }

    const countRows = await query(`SELECT COUNT(*) as total FROM suppliers s ${whereClause}`, params);
    const total = Number(countRows[0].total);

    params.push(Number(limit), offset);
    const suppliers = await query(
      `SELECT s.*, e.full_name as registered_by_name
       FROM suppliers s
       LEFT JOIN employees e ON s.registered_by = e.id
       ${whereClause}
       ORDER BY s.company_name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      success: true,
      data: {
        items: suppliers,
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

export async function checkSupplierDuplicate(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id;
    const { company_name, gst_number } = authReq.query;

    let possibleDuplicates: any[] = [];

    if (company_name || gst_number) {
      possibleDuplicates = await query(
        `SELECT id, supplier_code, company_name, contact_person, phone, gst_number
         FROM suppliers
         WHERE company_id = $1 AND (
           (company_name ILIKE $2) OR ($3 <> '' AND gst_number = $3)
         )`,
        [companyId, `%${company_name || ''}%`, gst_number || '']
      );
    }

    return res.json({
      success: true,
      has_duplicates: possibleDuplicates.length > 0,
      duplicates: possibleDuplicates
    });
  } catch (error) {
    next(error);
  }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = SupplierSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id!;
    const actorEmployeeId = authReq.employee?.id!;

    const existing = await query(
      `SELECT id, company_name FROM suppliers 
       WHERE company_id = $1 AND (LOWER(company_name) = LOWER($2) OR (gst_number IS NOT NULL AND gst_number = $3 AND $3 <> ''))`,
      [companyId, data.company_name, data.gst_number || '']
    );

    if (existing.length > 0 && authReq.headers['x-confirm-duplicate'] !== 'true') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_SUPPLIER',
          message: `A supplier with company name '${existing[0].company_name}' or matching GST already exists.`
        },
        data: { existing_supplier_id: existing[0].id }
      });
    }

    const countRes = await query(`SELECT COUNT(*) as cnt FROM suppliers WHERE company_id = $1`, [companyId]);
    const seq = Number(countRes[0].cnt) + 1;
    const supplierCode = `SUP-${String(seq).padStart(5, '0')}`;

    const result = await query(
      `INSERT INTO suppliers (
        supplier_code, company_id, company_name, contact_person, phone, email, address, gst_number, notes, status, registered_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', $10, $10)
      RETURNING *`,
      [
        supplierCode,
        companyId,
        data.company_name,
        data.contact_person,
        data.phone,
        data.email || null,
        data.address || null,
        data.gst_number || null,
        data.notes || null,
        actorEmployeeId
      ]
    );

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'SUPPLIER_CREATED',
      module: AUDIT_MODULES.SUPPLIER,
      entityType: 'Supplier',
      entityId: result[0].id,
      changeMetadata: { supplier_code: supplierCode, company_name: data.company_name }
    });

    return res.status(201).json({
      success: true,
      message: 'Supplier registered successfully',
      data: result[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function getSupplierHistory(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const companyId = authReq.user?.company_id;

    const supplierRows = await query(
      `SELECT s.*, e.full_name as registered_by_name
       FROM suppliers s
       LEFT JOIN employees e ON s.registered_by = e.id
       WHERE s.id = $1 AND s.company_id = $2`,
      [id, companyId]
    );

    if (supplierRows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
    }

    const supplier = supplierRows[0];

    const metricsRows = await query(
      `SELECT 
        COUNT(id) as total_orders_count,
        COALESCE(SUM(grand_total), 0) as total_purchases_amount,
        COALESCE(SUM(paid_amount), 0) as total_paid_amount,
        COALESCE(SUM(outstanding_amount), 0) as total_outstanding_amount
       FROM purchases
       WHERE supplier_id = $1 AND company_id = $2`,
      [id, companyId]
    );

    const productsRows = await query(
      `SELECT DISTINCT p.id, p.product_code, p.name, p.unit
       FROM products p
       JOIN purchase_items pi ON pi.product_id = p.id
       JOIN purchases pur ON pi.purchase_id = pur.id
       WHERE pur.supplier_id = $1 AND pur.company_id = $2`,
      [id, companyId]
    );

    const purchaseHistory = await query(
      `SELECT pur.*, e.full_name as created_by_name
       FROM purchases pur
       LEFT JOIN employees e ON pur.created_by = e.id
       WHERE pur.supplier_id = $1 AND pur.company_id = $2
       ORDER BY pur.purchase_date DESC`,
      [id, companyId]
    );

    const auditLogs = await query(
      `SELECT al.*, e.full_name as actor_employee_name
       FROM audit_logs al
       LEFT JOIN employees e ON al.actor_employee_id = e.id
       WHERE al.entity_type = 'Supplier' AND al.entity_id = $1
       ORDER BY al.timestamp DESC
       LIMIT 20`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        supplier,
        metrics: {
          total_orders_count: Number(metricsRows[0].total_orders_count),
          total_purchases_amount: Number(metricsRows[0].total_purchases_amount),
          total_paid_amount: Number(metricsRows[0].total_paid_amount),
          total_outstanding_amount: Number(metricsRows[0].total_outstanding_amount)
        },
        products_purchased: productsRows,
        purchase_history: purchaseHistory,
        audit_history: auditLogs
      }
    });
  } catch (error) {
    next(error);
  }
}
