import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { MaterialUsageSchema, DamagedMaterialSchema, MaterialTransferSchema } from '@construction/validation';
import { logAudit } from '../../services/audit.service.js';
import { AUDIT_MODULES } from '@construction/constants';

export async function getInventoryOverview(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const { site_id, category_id, search } = authReq.query;

    let whereClause = `WHERE (inv.company_id = $1 OR inv.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`;
    const params: any[] = [companyId];

    if (site_id) {
      params.push(site_id);
      whereClause += ` AND inv.site_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (pr.name ILIKE $${params.length} OR pr.product_code ILIKE $${params.length} OR st.name ILIKE $${params.length})`;
    }

    const items = await query(
      `SELECT inv.*, st.name as site_name, pr.name as product_name, pr.product_code, pc.name as category_name
       FROM inventory inv
       LEFT JOIN sites st ON inv.site_id = st.id
       LEFT JOIN products pr ON inv.product_id = pr.id
       LEFT JOIN product_categories pc ON pr.category_id = pc.id
       ${whereClause}
       ORDER BY st.name ASC, pr.name ASC`,
      params
    );

    // Summary calculations
    const totalItems = items ? items.length : 0;
    const lowStockCount = (items || []).filter((i: any) => Number(i.current_balance || 0) <= Number(i.min_stock_level || 10)).length;
    const totalDamagedCount = (items || []).reduce((acc: number, i: any) => acc + (Number(i.damaged_qty) || 0), 0);
    const totalExcessCount = (items || []).reduce((acc: number, i: any) => acc + (Number(i.unwanted_qty) || 0), 0);

    return res.json({
      success: true,
      data: {
        items: items || [],
        summary: {
          totalItems,
          lowStockCount,
          totalDamagedCount,
          totalExcessCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function recordMaterialUsage(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = MaterialUsageSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const actorEmployeeId = authReq.employee?.id!;

    // Check available inventory balance
    const existingInv = await query(
      `SELECT * FROM inventory WHERE site_id = $1 AND product_id = $2`,
      [data.site_id, data.product_id]
    );

    let inv = existingInv && existingInv.length > 0 ? existingInv[0] : null;
    const currentBal = inv ? Number(inv.current_balance || 0) : 0;

    if (currentBal < data.quantity_used) {
      return res.status(400).json({
        success: false,
        error: { code: 'INSUFFICIENT_STOCK', message: `Insufficient inventory balance. Available: ${currentBal} ${data.unit}, Requested Usage: ${data.quantity_used} ${data.unit}` }
      });
    }

    const usageId = crypto.randomUUID();

    // Insert usage record
    const usageRow = await query(
      `INSERT INTO material_usage (
        id, company_id, site_id, product_id, quantity_used, unit, activity, usage_date, used_by, notes, photo_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        usageId,
        companyId,
        data.site_id,
        data.product_id,
        data.quantity_used,
        data.unit,
        data.activity,
        data.usage_date,
        actorEmployeeId,
        data.notes || null,
        data.photo_url || null
      ]
    );

    // Update inventory balance dynamically
    const newUsed = Number(inv.used_qty || 0) + Number(data.quantity_used);
    const newBalance = Number(inv.opening_stock || 0) + Number(inv.received_qty || 0) + Number(inv.transferred_in_qty || 0) - newUsed - Number(inv.damaged_qty || 0) - Number(inv.unwanted_qty || 0) - Number(inv.transferred_out_qty || 0);

    await query(
      `UPDATE inventory SET used_qty = $1, current_balance = $2, updated_at = NOW() WHERE id = $3`,
      [newUsed, newBalance, inv.id]
    );

    // Record immutable inventory transaction
    await query(
      `INSERT INTO inventory_transactions (
        id, company_id, site_id, product_id, quantity, unit, transaction_type, reference_id, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        crypto.randomUUID(),
        companyId,
        data.site_id,
        data.product_id,
        data.quantity_used,
        data.unit,
        'Material Used',
        usageId,
        `Activity: ${data.activity}`,
        actorEmployeeId
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Material usage recorded successfully',
      data: usageRow[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function reportDamagedMaterial(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = DamagedMaterialSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const actorEmployeeId = authReq.employee?.id!;

    const existingInv = await query(
      `SELECT * FROM inventory WHERE site_id = $1 AND product_id = $2`,
      [data.site_id, data.product_id]
    );

    let inv = existingInv && existingInv.length > 0 ? existingInv[0] : null;

    const damageId = crypto.randomUUID();

    const damageRow = await query(
      `INSERT INTO damaged_materials (
        id, company_id, site_id, product_id, quantity, unit, damage_date, reason, description, photo_url, reported_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Reported')
      RETURNING *`,
      [
        damageId,
        companyId,
        data.site_id,
        data.product_id,
        data.quantity,
        data.unit,
        data.damage_date,
        data.reason,
        data.description || null,
        data.photo_url || null,
        actorEmployeeId
      ]
    );

    if (inv) {
      const newDamaged = Number(inv.damaged_qty || 0) + Number(data.quantity);
      const newBalance = Number(inv.opening_stock || 0) + Number(inv.received_qty || 0) + Number(inv.transferred_in_qty || 0) - Number(inv.used_qty || 0) - newDamaged - Number(inv.unwanted_qty || 0) - Number(inv.transferred_out_qty || 0);

      await query(
        `UPDATE inventory SET damaged_qty = $1, current_balance = $2, updated_at = NOW() WHERE id = $3`,
        [newDamaged, newBalance, inv.id]
      );
    }

    // Record transaction log
    await query(
      `INSERT INTO inventory_transactions (
        id, company_id, site_id, product_id, quantity, unit, transaction_type, reference_id, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        crypto.randomUUID(),
        companyId,
        data.site_id,
        data.product_id,
        data.quantity,
        data.unit,
        'Damaged',
        damageId,
        `Reason: ${data.reason}`,
        actorEmployeeId
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Damaged material reported successfully',
      data: damageRow[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function createMaterialTransfer(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = MaterialTransferSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const actorEmployeeId = authReq.employee?.id!;

    // Sequence TRF-XXXX
    const countRes = await query(
      `SELECT COUNT(*) as cnt FROM material_transfers WHERE (company_id = $1 OR company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`,
      [companyId]
    );
    const cntVal = Number(countRes[0]?.cnt ?? countRes[0]?.total ?? countRes[0]?.count ?? 0);
    const seq = isNaN(cntVal) || cntVal < 0 ? 1 : cntVal + 1;
    const transferCode = `TRF-${String(seq).padStart(4, '0')}`;

    const trfId = crypto.randomUUID();

    const inserted = await query(
      `INSERT INTO material_transfers (
        id, transfer_code, company_id, from_site_id, to_site_id, product_id, quantity, unit, reason, status, requested_by, transfer_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', $10, $11)
      RETURNING *`,
      [
        trfId,
        transferCode,
        companyId,
        data.from_site_id,
        data.to_site_id,
        data.product_id,
        data.quantity,
        data.unit,
        data.reason,
        actorEmployeeId,
        data.transfer_date
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Material transfer request created successfully',
      data: inserted[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMaterialTransferStatus(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const { status, notes } = req.body;
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const actorEmployeeId = authReq.employee?.id!;

    const trfRows = await query(
      `SELECT * FROM material_transfers WHERE id = $1 AND (company_id = $2 OR company_id IS NULL OR $2 = '00000000-0000-0000-0000-000000000001')`,
      [id, companyId]
    );

    if (!trfRows || trfRows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Material transfer request not found' } });
    }

    const trf = trfRows[0];

    const updated = await query(
      `UPDATE material_transfers SET
        status = $1,
        approved_by = CASE WHEN $1 IN ('Approved', 'In Transit') THEN $2 ELSE approved_by END,
        received_by = CASE WHEN $1 = 'Received' THEN $2 ELSE received_by END,
        received_date = CASE WHEN $1 = 'Received' THEN NOW() ELSE received_date END,
        notes = COALESCE($3, notes),
        updated_at = NOW()
       WHERE id = $4 AND (company_id = $5 OR company_id IS NULL OR $5 = '00000000-0000-0000-0000-000000000001')
       RETURNING *`,
      [status, actorEmployeeId, notes || null, id, companyId]
    );

    // CRITICAL RULE: When transfer is marked RECEIVED, update stock on BOTH sites!
    if (status === 'Received') {
      // 1. From Site: Increase transferred_out_qty
      const fromInv = await query(`SELECT * FROM inventory WHERE site_id = $1 AND product_id = $2`, [trf.from_site_id, trf.product_id]);
      if (fromInv && fromInv.length > 0) {
        const invA = fromInv[0];
        const newOut = Number(invA.transferred_out_qty || 0) + Number(trf.quantity);
        const newBalA = Number(invA.opening_stock || 0) + Number(invA.received_qty || 0) + Number(invA.transferred_in_qty || 0) - Number(invA.used_qty || 0) - Number(invA.damaged_qty || 0) - Number(invA.unwanted_qty || 0) - newOut;

        await query(`UPDATE inventory SET transferred_out_qty = $1, current_balance = $2, updated_at = NOW() WHERE id = $3`, [newOut, newBalA, invA.id]);
      }

      // 2. To Site: Increase transferred_in_qty
      const toInv = await query(`SELECT * FROM inventory WHERE site_id = $1 AND product_id = $2`, [trf.to_site_id, trf.product_id]);
      if (toInv && toInv.length > 0) {
        const invB = toInv[0];
        const newIn = Number(invB.transferred_in_qty || 0) + Number(trf.quantity);
        const newBalB = Number(invB.opening_stock || 0) + Number(invB.received_qty || 0) + newIn - Number(invB.used_qty || 0) - Number(invB.damaged_qty || 0) - Number(invB.unwanted_qty || 0) - Number(invB.transferred_out_qty || 0);

        await query(`UPDATE inventory SET transferred_in_qty = $1, current_balance = $2, updated_at = NOW() WHERE id = $3`, [newIn, newBalB, invB.id]);
      } else {
        await query(
          `INSERT INTO inventory (id, company_id, site_id, product_id, opening_stock, transferred_in_qty, current_balance, unit)
           VALUES ($1, $2, $3, $4, 0, $5, $5, $6)`,
          [crypto.randomUUID(), companyId, trf.to_site_id, trf.product_id, trf.quantity, trf.unit]
        );
      }

      // Record immutable transactions for both sites
      await query(
        `INSERT INTO inventory_transactions (id, company_id, site_id, product_id, quantity, unit, transaction_type, reference_id, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'Transfer Out', $7, 'Transferred to another site', $8)`,
        [crypto.randomUUID(), companyId, trf.from_site_id, trf.product_id, trf.quantity, trf.unit, id, actorEmployeeId]
      );

      await query(
        `INSERT INTO inventory_transactions (id, company_id, site_id, product_id, quantity, unit, transaction_type, reference_id, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'Transfer In', $7, 'Received from site transfer', $8)`,
        [crypto.randomUUID(), companyId, trf.to_site_id, trf.product_id, trf.quantity, trf.unit, id, actorEmployeeId]
      );
    }

    return res.json({
      success: true,
      message: `Material transfer status updated to ${status}`,
      data: updated[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function getMaterialTransfers(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const { status, site_id } = authReq.query;

    let whereClause = `WHERE (mt.company_id = $1 OR mt.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`;
    const params: any[] = [companyId];

    if (site_id) {
      params.push(site_id);
      whereClause += ` AND (mt.from_site_id = $${params.length} OR mt.to_site_id = $${params.length})`;
    }

    if (status) {
      params.push(status);
      whereClause += ` AND mt.status = $${params.length}`;
    }

    const transfers = await query(
      `SELECT mt.*, s1.name as from_site_name, s2.name as to_site_name, pr.name as product_name, e.full_name as requested_by_name
       FROM material_transfers mt
       LEFT JOIN sites s1 ON mt.from_site_id = s1.id
       LEFT JOIN sites s2 ON mt.to_site_id = s2.id
       LEFT JOIN products pr ON mt.product_id = pr.id
       LEFT JOIN employees e ON mt.requested_by = e.id
       ${whereClause}
       ORDER BY mt.created_at DESC`,
      params
    );

    return res.json({
      success: true,
      data: {
        items: transfers || [],
        total: transfers ? transfers.length : 0
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getInventoryTransactions(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const { site_id, transaction_type } = authReq.query;

    let whereClause = `WHERE (it.company_id = $1 OR it.company_id IS NULL OR $1 = '00000000-0000-0000-0000-000000000001')`;
    const params: any[] = [companyId];

    if (site_id) {
      params.push(site_id);
      whereClause += ` AND it.site_id = $${params.length}`;
    }

    if (transaction_type) {
      params.push(transaction_type);
      whereClause += ` AND it.transaction_type = $${params.length}`;
    }

    const transactions = await query(
      `SELECT it.*, st.name as site_name, pr.name as product_name, e.full_name as created_by_name
       FROM inventory_transactions it
       LEFT JOIN sites st ON it.site_id = st.id
       LEFT JOIN products pr ON it.product_id = pr.id
       LEFT JOIN employees e ON it.created_by = e.id
       ${whereClause}
       ORDER BY it.created_at DESC`,
      params
    );

    return res.json({
      success: true,
      data: {
        items: transactions || [],
        total: transactions ? transactions.length : 0
      }
    });
  } catch (error) {
    next(error);
  }
}
