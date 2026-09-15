import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query, memoryStore } from '../../config/db.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { LeaveTypeSchema, LeaveRequestSchema, LeaveApprovalSchema } from '@construction/validation';
import { logAudit } from '../../services/audit.service.js';
import { AUDIT_MODULES } from '@construction/constants';

export async function getLeaveTypes(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id;
    const leaveTypes = await query(`SELECT * FROM leave_types WHERE company_id = $1 ORDER BY name ASC`, [companyId]);
    return res.json({ success: true, data: leaveTypes });
  } catch (error) {
    next(error);
  }
}

export async function createLeaveType(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = LeaveTypeSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id!;
    const actorEmployeeId = authReq.employee?.id!;

    const result = await query(
      `INSERT INTO leave_types (company_id, name, allocated_days, year, status)
       VALUES ($1, $2, $3, $4, 'Active')
       RETURNING *`,
      [companyId, data.name, data.allocated_days, data.year]
    );

    const newLt = result[0];

    // Auto-allocate leave balances for all active employees
    const activeEmployees = await query(`SELECT id FROM employees WHERE company_id = $1 AND status = 'Active'`, [companyId]);
    for (const emp of activeEmployees) {
      const newBalance = {
        id: crypto.randomUUID(),
        employee_id: emp.id,
        leave_type_id: newLt.id,
        leave_type_name: data.name,
        year: data.year,
        allocated_days: data.allocated_days,
        used_days: 0,
        remaining_days: data.allocated_days
      };
      memoryStore.employee_leave_balances.push(newBalance as any);
    }

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'LEAVE_TYPE_CREATED',
      module: AUDIT_MODULES.LEAVE,
      entityType: 'LeaveType',
      entityId: newLt.id,
      changeMetadata: data
    });

    return res.status(201).json({ success: true, message: 'Leave type created successfully', data: newLt });
  } catch (error) {
    next(error);
  }
}

export async function getLeaveBalances(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { employee_id, year = new Date().getFullYear() } = authReq.query;
    
    // Check if the user is an admin or fetching their own balances
    // Since we don't have direct role checks here, we assume if they can access this route they can see the balances they requested
    // If employee_id is provided, filter by it. Otherwise, return all (assuming admin view).
    
    const balances = memoryStore.employee_leave_balances.filter(
      (b: any) => (!employee_id || b.employee_id === employee_id) &&
                  (!year || b.year === Number(year))
    ).map((b: any) => {
      // It's possible memoryStore.leave_types is empty because they are in Postgres.
      // But we mapped leave_type_name during creation, so it should be preserved.
      return { ...b };
    });

    return res.json({ success: true, data: balances });
  } catch (error) {
    next(error);
  }
}

export async function getLeaveRequests(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { employee_id, status } = authReq.query;

    let items = [...memoryStore.leave_requests];

    if (employee_id) {
      items = items.filter((r: any) => r.employee_id === employee_id);
    }
    if (status) {
      items = items.filter((r: any) => r.status === status);
    }

    return res.json({
      success: true,
      data: {
        items,
        total: items.length,
        page: 1,
        limit: 50,
        total_pages: 1
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function submitLeaveRequest(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const data = LeaveRequestSchema.parse(authReq.body);
    const employeeId = data.employee_id || authReq.employee?.id!;

    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const year = start.getFullYear();

    // Check leave balance
    let bal = memoryStore.employee_leave_balances.find(
      (b: any) => b.employee_id === employeeId &&
                  b.leave_type_id === data.leave_type_id &&
                  b.year === year
    ) as any;

    let ltObj: any = null;

    if (!bal) {
      // If no balance found, create one from the leave type
      const ltRes = await query(`SELECT * FROM leave_types WHERE id = $1`, [data.leave_type_id]);
      ltObj = ltRes[0];
      
      if (ltObj) {
        bal = {
          id: crypto.randomUUID(),
          employee_id: employeeId,
          leave_type_id: data.leave_type_id,
          leave_type_name: ltObj.name || 'Leave',
          year,
          allocated_days: ltObj.allocated_days || 12,
          used_days: 0,
          remaining_days: ltObj.allocated_days || 12
        };
        memoryStore.employee_leave_balances.push(bal);
      }
    } else {
      const ltRes = await query(`SELECT * FROM leave_types WHERE id = $1`, [data.leave_type_id]);
      ltObj = ltRes[0];
    }

    const empRes = await query(`SELECT * FROM employees WHERE id = $1`, [employeeId]);
    const empObj = empRes[0];

    const newRequest = {
      id: crypto.randomUUID(),
      employee_id: employeeId,
      employee_name: empObj?.full_name || 'Employee',
      leave_type_id: data.leave_type_id,
      leave_type_name: ltObj?.name || 'Leave',
      start_date: data.start_date,
      end_date: data.end_date,
      total_days: totalDays,
      reason: data.reason,
      status: 'Pending',
      created_at: new Date().toISOString()
    };

    memoryStore.leave_requests.unshift(newRequest as any);

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId: employeeId,
      action: 'LEAVE_REQUESTED',
      module: AUDIT_MODULES.LEAVE,
      entityType: 'LeaveRequest',
      entityId: newRequest.id,
      changeMetadata: { start_date: data.start_date, end_date: data.end_date, total_days: totalDays }
    });

    return res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: newRequest
    });
  } catch (error) {
    next(error);
  }
}

export async function processLeaveApproval(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const { status, notes } = LeaveApprovalSchema.parse(authReq.body);
    const actorEmployeeId = authReq.employee?.id!;
    const actorEmp = memoryStore.employees.find((e) => e.id === actorEmployeeId);

    // Find leave request in memory
    const leaveReq = memoryStore.leave_requests.find((r: any) => r.id === id) as any;
    if (!leaveReq) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Leave request not found' } });
    }

    if (leaveReq.status !== 'Pending') {
      return res.status(400).json({ success: false, error: { code: 'INVALID', message: 'Leave request is already processed' } });
    }

    // Update status
    leaveReq.status = status;
    leaveReq.approved_by = actorEmployeeId;
    leaveReq.approved_by_name = actorEmp?.full_name || 'System Administrator';
    leaveReq.approved_at = new Date().toISOString();
    leaveReq.approval_notes = notes || null;

    // If Approved → Deduct leave balance
    if (status === 'Approved') {
      const year = new Date(leaveReq.start_date).getFullYear();
      const bal = memoryStore.employee_leave_balances.find(
        (b: any) => b.employee_id === leaveReq.employee_id &&
                    b.leave_type_id === leaveReq.leave_type_id &&
                    b.year === year
      ) as any;

      if (bal) {
        bal.used_days = (Number(bal.used_days) || 0) + Number(leaveReq.total_days);
        bal.remaining_days = Math.max(0, (Number(bal.allocated_days) || 0) - bal.used_days);
      }
    }

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: status === 'Approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      module: AUDIT_MODULES.LEAVE,
      entityType: 'LeaveRequest',
      entityId: id,
      changeMetadata: { status, notes }
    });

    return res.json({
      success: true,
      message: `Leave request ${status.toLowerCase()} successfully`,
      data: leaveReq
    });
  } catch (error) {
    next(error);
  }
}
