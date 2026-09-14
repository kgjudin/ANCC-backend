import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { HolidaySchema } from '@construction/validation';
import { logAudit } from '../../services/audit.service.js';
import { AUDIT_MODULES } from '@construction/constants';

export async function getHolidays(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id;
    const { year = new Date().getFullYear() } = authReq.query;

    const holidays = await query(
      `SELECT * FROM holidays WHERE company_id = $1 AND year = $2 ORDER BY date ASC`,
      [companyId, Number(year)]
    );

    return res.json({ success: true, data: holidays });
  } catch (error) {
    next(error);
  }
}

export async function createHoliday(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = HolidaySchema.parse(authReq.body);
    const companyId = authReq.user?.company_id!;
    const actorEmployeeId = authReq.employee?.id!;

    const result = await query(
      `INSERT INTO holidays (company_id, name, date, year, holiday_type, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [companyId, data.name, data.date, data.year, data.holiday_type, data.description || null, actorEmployeeId]
    );

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'HOLIDAY_CREATED',
      module: AUDIT_MODULES.HOLIDAY,
      entityType: 'Holiday',
      entityId: result[0].id,
      changeMetadata: data
    });

    return res.status(201).json({ success: true, message: 'Holiday created successfully', data: result[0] });
  } catch (error) {
    next(error);
  }
}

export async function deleteHoliday(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const companyId = authReq.user?.company_id!;
    const actorEmployeeId = authReq.employee?.id!;

    await query(`DELETE FROM holidays WHERE id = $1 AND company_id = $2`, [id, companyId]);

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'HOLIDAY_DELETED',
      module: AUDIT_MODULES.HOLIDAY,
      entityType: 'Holiday',
      entityId: id
    });

    return res.json({ success: true, message: 'Holiday deleted successfully' });
  } catch (error) {
    next(error);
  }
}
