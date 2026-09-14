import { Request, Response, NextFunction } from 'express';
import { query, memoryStore } from '../../config/db.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { CreateRoleSchema, UpdateRoleSchema } from '@construction/validation';
import { logAudit } from '../../services/audit.service.js';
import { AUDIT_MODULES } from '@construction/constants';

const PERM_DESCRIPTIONS: Record<string, { module: string; description: string }> = {
  'employee.view': { module: 'Employee', description: 'View employee records & directory' },
  'employee.create': { module: 'Employee', description: 'Register new employee profiles' },
  'employee.edit': { module: 'Employee', description: 'Edit employee details & status' },
  'employee.delete': { module: 'Employee', description: 'Deactivate or delete employees' },
  'attendance.view': { module: 'Attendance', description: 'View daily attendance logs & matrix' },
  'attendance.edit': { module: 'Attendance', description: 'Modify check-in/out attendance logs' },
  'leave.view': { module: 'Leave', description: 'View leave requests & balances' },
  'leave.request': { module: 'Leave', description: 'Submit leave applications' },
  'leave.approve': { module: 'Leave', description: 'Approve pending leave requests' },
  'leave.reject': { module: 'Leave', description: 'Reject pending leave requests' },
  'holiday.view': { module: 'Holiday', description: 'View company yearly holidays' },
  'holiday.create': { module: 'Holiday', description: 'Add new company holidays' },
  'holiday.edit': { module: 'Holiday', description: 'Modify company holiday dates' },
  'holiday.delete': { module: 'Holiday', description: 'Remove company holidays' },
  'supplier.view': { module: 'Supplier', description: 'View supplier catalog & history' },
  'supplier.create': { module: 'Supplier', description: 'Register new material suppliers' },
  'supplier.edit': { module: 'Supplier', description: 'Update supplier contact & GST' },
  'supplier.delete': { module: 'Supplier', description: 'Disable or delete suppliers' },
  'product.view': { module: 'Product', description: 'View products & materials catalog' },
  'product.create': { module: 'Product', description: 'Add new products & materials' },
  'product.edit': { module: 'Product', description: 'Update standard rates & categories' },
  'product.delete': { module: 'Product', description: 'Remove products from catalog' },
  'purchase.view': { module: 'Purchase', description: 'View purchase orders & history' },
  'purchase.create': { module: 'Purchase', description: 'Create material purchase orders' },
  'purchase.edit': { module: 'Purchase', description: 'Update purchase payment status' },
  'purchase.delete': { module: 'Purchase', description: 'Cancel purchase records' },
  'purchase.approve': { module: 'Purchase', description: 'Approve purchase orders' },
  'expense.view': { module: 'Expense', description: 'View company expenses & ledger' },
  'expense.create': { module: 'Expense', description: 'Record new site expenses' },
  'expense.edit': { module: 'Expense', description: 'Update site expense entries' },
  'expense.delete': { module: 'Expense', description: 'Remove expense entries' },
  'site.view': { module: 'Site Network', description: 'View construction sites & locations' },
  'site.create': { module: 'Site Network', description: 'Register new construction sites' },
  'site.edit': { module: 'Site Network', description: 'Edit site details & site manager' },
  'site.delete': { module: 'Site Network', description: 'Deactivate or delete construction sites' },
  'finance.view': { module: 'Finance', description: 'View accountant console & invoices' },
  'finance.create': { module: 'Finance', description: 'Create dynamic bills & invoices' },
  'finance.approve': { module: 'Finance', description: 'Approve pending financial bills' },
  'finance.delete': { module: 'Finance', description: 'Cancel or remove financial bills' },
  'product_request.view': { module: 'Product Requests', description: 'View site material requisitions' },
  'product_request.create': { module: 'Product Requests', description: 'Submit new product requisitions' },
  'product_request.approve': { module: 'Product Requests', description: 'Approve site product requisitions' },
  'product_request.fulfill': { module: 'Product Requests', description: 'Fulfill material requisitions' },
  'inventory.view': { module: 'Inventory', description: 'View site-wise stock overview' },
  'inventory.manage': { module: 'Inventory', description: 'Manage inventory stock levels' },
  'inventory.usage': { module: 'Inventory', description: 'Record site material usage' },
  'inventory.damage': { module: 'Inventory', description: 'Report damaged material stock' },
  'inventory.transfer': { module: 'Inventory', description: 'Transfer materials between sites' },
  'report.view': { module: 'Report', description: 'View executive & financial reports' },
  'report.export': { module: 'Report', description: 'Export PDF & CSV data reports' },
  'audit_log.view': { module: 'Audit', description: 'View system activity audit logs' },
  'chat.view': { module: 'Chat', description: 'View & use team chat messaging' }
};

function buildPermObjects(keys: string[]) {
  return keys.map((k) => ({
    key: k,
    module: PERM_DESCRIPTIONS[k]?.module || k.split('.')[0],
    description: PERM_DESCRIPTIONS[k]?.description || k
  }));
}

export async function getPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const permissions = await query(`SELECT * FROM permissions ORDER BY module, key`);
    return res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
}

export async function getRoles(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';

    // Fetch roles & dynamically joined permissions from database
    const roles = await query(
      `SELECT r.*, 
        COALESCE(
          (SELECT json_agg(json_build_object('id', p.id, 'key', p.key, 'module', p.module, 'description', p.description))
           FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id
           WHERE rp.role_id = r.id),
          '[]'::json
        ) as permissions
       FROM roles r
       WHERE r.company_id = $1
       ORDER BY r.created_at ASC`,
      [companyId]
    );

    const rawRoles = roles && roles.length > 0 ? roles : memoryStore.roles;

    // Deduplicate roles by name to guarantee NO duplicate roles return
    const uniqueRoles: any[] = [];
    const seenNames = new Set<string>();

    for (const r of rawRoles) {
      const normalizedName = (r.name || '').trim().toLowerCase();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        uniqueRoles.push(r);
      }
    }

    return res.json({ success: true, data: uniqueRoles });
  } catch (error) {
    next(error);
  }
}

export async function getRoleById(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';

    const roles = await query(
      `SELECT r.*, 
        COALESCE(
          (SELECT json_agg(json_build_object('id', p.id, 'key', p.key, 'module', p.module, 'description', p.description))
           FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id
           WHERE rp.role_id = r.id),
          '[]'::json
        ) as permissions
       FROM roles r
       WHERE r.id = $1 AND r.company_id = $2`,
      [id, companyId]
    );

    if (roles && roles.length > 0) {
      return res.json({ success: true, data: roles[0] });
    }

    const memRole = memoryStore.roles.find((r) => r.id === id);
    if (memRole) {
      return res.json({ success: true, data: memRole });
    }

    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } });
  } catch (error) {
    next(error);
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { name, description, permissions } = CreateRoleSchema.parse(authReq.body);
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
    const actorEmployeeId = authReq.employee?.id!;

    // Check if role name already exists in memoryStore or DB to avoid duplicate creation
    const existingMemIdx = memoryStore.roles.findIndex(
      (r) => r.name.toLowerCase() === name.toLowerCase() && (r.company_id === companyId || !r.company_id)
    );

    const roleId = existingMemIdx >= 0 ? memoryStore.roles[existingMemIdx].id : crypto.randomUUID();

    const permKeys: string[] = permissions || [];
    const permObjects = buildPermObjects(permKeys);

    // 1. Insert/Update PostgreSQL database roles table
    await query(
      `INSERT INTO roles (id, company_id, name, description, is_system)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (company_id, name) DO UPDATE SET description = EXCLUDED.description`,
      [roleId, companyId, name, description || null]
    );

    // 2. Clear & Insert assigned permissions into role_permissions table
    await query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);

    for (const key of permKeys) {
      await query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE key = $2
         ON CONFLICT DO NOTHING`,
        [roleId, key]
      );
    }

    // 3. Keep in-memory store updated safely WITHOUT double-pushing
    const newRoleObj = {
      id: roleId,
      company_id: companyId,
      name,
      description,
      is_system: false,
      permissions: permObjects,
      created_at: new Date().toISOString()
    };

    if (existingMemIdx >= 0) {
      memoryStore.roles[existingMemIdx] = newRoleObj as any;
    } else {
      memoryStore.roles.push(newRoleObj as any);
    }

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'ROLE_CREATED',
      module: AUDIT_MODULES.ROLE,
      entityType: 'Role',
      entityId: roleId,
      changeMetadata: { name, description, permissions: permKeys }
    });

    return res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: newRoleObj
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id } = authReq.params;
    const { name, description, permissions } = UpdateRoleSchema.parse(authReq.body);
    const actorEmployeeId = authReq.employee?.id!;
    const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';

    // 1. Update roles table in database
    await query(
      `UPDATE roles 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description)
       WHERE id = $3 AND company_id = $4`,
      [name || null, description || null, id, companyId]
    );

    // 2. Dynamically update role_permissions mapping in database
    if (permissions !== undefined && Array.isArray(permissions)) {
      await query(`DELETE FROM role_permissions WHERE role_id = $1`, [id]);

      for (const key of permissions) {
        await query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE key = $2
           ON CONFLICT DO NOTHING`,
          [id, key]
        );
      }
    }

    // 3. Keep in-memory store updated safely
    const rObj = memoryStore.roles.find((r) => r.id === id);
    if (rObj) {
      if (name) rObj.name = name;
      if (description) rObj.description = description;
      if (permissions !== undefined) {
        rObj.permissions = buildPermObjects(permissions) as any;
      }
    }

    await logAudit({
      actorUserId: authReq.user?.id,
      actorEmployeeId,
      action: 'ROLE_UPDATED',
      module: AUDIT_MODULES.ROLE,
      entityType: 'Role',
      entityId: id,
      changeMetadata: { name, description, permissions }
    });

    return res.json({
      success: true,
      message: 'Role updated successfully',
      data: rObj || { id, company_id: companyId, name, description, permissions: buildPermObjects(permissions || []) }
    });
  } catch (error) {
    next(error);
  }
}
