import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { SiteSchema } from '@construction/validation';
import { logAudit } from '../../services/audit.service.js';
import { AUDIT_MODULES } from '@construction/constants';

export async function getSites(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const { search, status } = authReq.query;

    let whereClause = `WHERE (st.company_id = $1 OR st.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`;
    const params: any[] = [companyId];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (st.name ILIKE $${params.length} OR st.site_code ILIKE $${params.length} OR st.location ILIKE $${params.length})`;
    }

    if (status) {
      params.push(status);
      whereClause += ` AND st.status = $${params.length}`;
    }

    const sites = await query(
      `SELECT st.*, e.full_name as site_manager_name
       FROM sites st
       LEFT JOIN employees e ON st.site_manager_id = e.id
       ${whereClause}
       ORDER BY st.created_at DESC`,
      params
    );

    return res.json({
      success: true,
      data: {
        items: sites || [],
        total: sites ? sites.length : 0
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createSite(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = SiteSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const actorEmployeeId = authReq.employee?.id!;

    // Generate unique site code SITE-XXXX
    const countRes = await query(
      `SELECT COUNT(*) as cnt FROM sites WHERE (company_id = $1 OR company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`,
      [companyId]
    );
    const cntVal = Number(countRes[0]?.cnt ?? countRes[0]?.total ?? countRes[0]?.count ?? 0);
    const seq = isNaN(cntVal) || cntVal < 0 ? 1 : cntVal + 1;
    const siteCode = `SITE-${String(seq).padStart(4, '0')}`;

    const siteId = crypto.randomUUID();

    const siteRows = await query(
      `INSERT INTO sites (
        id, company_id, site_code, name, location, site_manager_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        siteId,
        companyId,
        siteCode,
        data.name,
        data.location || null,
        data.site_manager_id && String(data.site_manager_id).trim() !== '' ? data.site_manager_id : null,
        data.status || 'Active'
      ]
    );

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'SITE_CREATED',
      module: AUDIT_MODULES.EMPLOYEE,
      entityType: 'Site',
      entityId: siteId,
      changeMetadata: { site_code: siteCode, name: data.name }
    });

    return res.status(201).json({
      success: true,
      message: 'Construction site added successfully',
      data: siteRows[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSite(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const data = SiteSchema.partial().parse(authReq.body);
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';

    const updated = await query(
      `UPDATE sites SET
        name = COALESCE($1, name),
        location = COALESCE($2, location),
        site_manager_id = COALESCE($3, site_manager_id),
        status = COALESCE($4, status),
        updated_at = NOW()
       WHERE id = $5 AND (company_id = $6 OR company_id IS NULL OR $6 = '00000000-0000-0000-0000-000000000001')
       RETURNING *`,
      [
        data.name || null,
        data.location || null,
        data.site_manager_id || null,
        data.status || null,
        id,
        companyId
      ]
    );

    return res.json({
      success: true,
      message: 'Construction site updated successfully',
      data: updated[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function getSiteById(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';

    const siteRows = await query(
      `SELECT st.*, e.full_name as site_manager_name, e.email as site_manager_email, e.phone as site_manager_phone
       FROM sites st
       LEFT JOIN employees e ON st.site_manager_id = e.id
       WHERE st.id = $1 AND (st.company_id = $2 OR st.company_id IS NULL OR $2 = '00000000-0000-0000-0000-000000000001')`,
      [id, companyId]
    );

    if (!siteRows || siteRows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } });
    }

    const site = siteRows[0];

    const purchases = await query(
      `SELECT p.id, p.purchase_number, p.grand_total, p.payment_status, p.purchase_date, s.company_name as supplier_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.notes ILIKE $1
       ORDER BY p.purchase_date DESC LIMIT 10`,
      [`%${site.name}%`]
    );

    const expenses = await query(
      `SELECT ex.id, ex.category, ex.amount, ex.date, ex.description
       FROM expenses ex
       WHERE ex.description ILIKE $1 OR ex.description ILIKE $2
       ORDER BY ex.date DESC LIMIT 10`,
      [`%${site.name}%`, `%${site.site_code}%`]
    );

    const totalPurchases = (purchases || []).reduce((acc: number, item: any) => acc + (Number(item.grand_total) || 0), 0);
    const totalExpenses = (expenses || []).reduce((acc: number, item: any) => acc + (Number(item.amount) || 0), 0);

    return res.json({
      success: true,
      data: {
        ...site,
        metrics: {
          total_purchases_amount: totalPurchases,
          total_expenses_amount: totalExpenses,
          purchases_count: purchases ? purchases.length : 0,
          expenses_count: expenses ? expenses.length : 0
        },
        purchases: purchases || [],
        expenses: expenses || []
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSite(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';

    const deleted = await query(
      `DELETE FROM sites WHERE id = $1 AND (company_id = $2 OR company_id IS NULL OR $2 = '00000000-0000-0000-0000-000000000001') RETURNING *`,
      [id, companyId]
    );

    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found or already deleted' } });
    }

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId: authReq.employee?.id!,
      action: 'SITE_DELETED',
      module: AUDIT_MODULES.EMPLOYEE,
      entityType: 'Site',
      entityId: id,
      changeMetadata: { site_id: id }
    });

    return res.json({
      success: true,
      message: 'Construction site removed successfully'
    });
  } catch (error) {
    next(error);
  }
}

