"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPermissions = getPermissions;
exports.getRoles = getRoles;
exports.getRoleById = getRoleById;
exports.createRole = createRole;
exports.updateRole = updateRole;
const db_js_1 = require("../../config/db.js");
const validation_1 = require("@construction/validation");
const audit_service_js_1 = require("../../services/audit.service.js");
const constants_1 = require("@construction/constants");
const PERM_DESCRIPTIONS = {
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
function buildPermObjects(keys) {
    return keys.map((k) => ({
        key: k,
        module: PERM_DESCRIPTIONS[k]?.module || k.split('.')[0],
        description: PERM_DESCRIPTIONS[k]?.description || k
    }));
}
async function getPermissions(req, res, next) {
    try {
        const permissions = await (0, db_js_1.query)(`SELECT * FROM permissions ORDER BY module, key`);
        return res.json({ success: true, data: permissions });
    }
    catch (error) {
        next(error);
    }
}
async function getRoles(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        // Fetch roles & dynamically joined permissions from database
        const roles = await (0, db_js_1.query)(`SELECT r.*, 
        COALESCE(
          (SELECT json_agg(json_build_object('id', p.id, 'key', p.key, 'module', p.module, 'description', p.description))
           FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id
           WHERE rp.role_id = r.id),
          '[]'::json
        ) as permissions
       FROM roles r
       WHERE r.company_id = $1
       ORDER BY r.created_at ASC`, [companyId]);
        const rawRoles = roles && roles.length > 0 ? roles : db_js_1.memoryStore.roles;
        // Deduplicate roles by name to guarantee NO duplicate roles return
        const uniqueRoles = [];
        const seenNames = new Set();
        for (const r of rawRoles) {
            const normalizedName = (r.name || '').trim().toLowerCase();
            if (!seenNames.has(normalizedName)) {
                seenNames.add(normalizedName);
                uniqueRoles.push(r);
            }
        }
        return res.json({ success: true, data: uniqueRoles });
    }
    catch (error) {
        next(error);
    }
}
async function getRoleById(req, res, next) {
    const authReq = req;
    try {
        const { id } = authReq.params;
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const roles = await (0, db_js_1.query)(`SELECT r.*, 
        COALESCE(
          (SELECT json_agg(json_build_object('id', p.id, 'key', p.key, 'module', p.module, 'description', p.description))
           FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id
           WHERE rp.role_id = r.id),
          '[]'::json
        ) as permissions
       FROM roles r
       WHERE r.id = $1 AND r.company_id = $2`, [id, companyId]);
        if (roles && roles.length > 0) {
            return res.json({ success: true, data: roles[0] });
        }
        const memRole = db_js_1.memoryStore.roles.find((r) => r.id === id);
        if (memRole) {
            return res.json({ success: true, data: memRole });
        }
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } });
    }
    catch (error) {
        next(error);
    }
}
async function createRole(req, res, next) {
    const authReq = req;
    try {
        const { name, description, permissions } = validation_1.CreateRoleSchema.parse(authReq.body);
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        const actorEmployeeId = authReq.employee?.id;
        // Check if role name already exists in memoryStore or DB to avoid duplicate creation
        const existingMemIdx = db_js_1.memoryStore.roles.findIndex((r) => r.name.toLowerCase() === name.toLowerCase() && (r.company_id === companyId || !r.company_id));
        const roleId = existingMemIdx >= 0 ? db_js_1.memoryStore.roles[existingMemIdx].id : crypto.randomUUID();
        const permKeys = permissions || [];
        const permObjects = buildPermObjects(permKeys);
        // 1. Insert/Update PostgreSQL database roles table
        await (0, db_js_1.query)(`INSERT INTO roles (id, company_id, name, description, is_system)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (company_id, name) DO UPDATE SET description = EXCLUDED.description`, [roleId, companyId, name, description || null]);
        // 2. Clear & Insert assigned permissions into role_permissions table
        await (0, db_js_1.query)(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
        for (const key of permKeys) {
            await (0, db_js_1.query)(`INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE key = $2
         ON CONFLICT DO NOTHING`, [roleId, key]);
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
            db_js_1.memoryStore.roles[existingMemIdx] = newRoleObj;
        }
        else {
            db_js_1.memoryStore.roles.push(newRoleObj);
        }
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'ROLE_CREATED',
            module: constants_1.AUDIT_MODULES.ROLE,
            entityType: 'Role',
            entityId: roleId,
            changeMetadata: { name, description, permissions: permKeys }
        });
        return res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: newRoleObj
        });
    }
    catch (error) {
        next(error);
    }
}
async function updateRole(req, res, next) {
    const authReq = req;
    try {
        const { id } = authReq.params;
        const { name, description, permissions } = validation_1.UpdateRoleSchema.parse(authReq.body);
        const actorEmployeeId = authReq.employee?.id;
        const companyId = authReq.user?.company_id || '00000000-0000-0000-0000-000000000001';
        // 1. Update roles table in database
        await (0, db_js_1.query)(`UPDATE roles 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description)
       WHERE id = $3 AND company_id = $4`, [name || null, description || null, id, companyId]);
        // 2. Dynamically update role_permissions mapping in database
        if (permissions !== undefined && Array.isArray(permissions)) {
            await (0, db_js_1.query)(`DELETE FROM role_permissions WHERE role_id = $1`, [id]);
            for (const key of permissions) {
                await (0, db_js_1.query)(`INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE key = $2
           ON CONFLICT DO NOTHING`, [id, key]);
            }
        }
        // 3. Keep in-memory store updated safely
        const rObj = db_js_1.memoryStore.roles.find((r) => r.id === id);
        if (rObj) {
            if (name)
                rObj.name = name;
            if (description)
                rObj.description = description;
            if (permissions !== undefined) {
                rObj.permissions = buildPermObjects(permissions);
            }
        }
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'ROLE_UPDATED',
            module: constants_1.AUDIT_MODULES.ROLE,
            entityType: 'Role',
            entityId: id,
            changeMetadata: { name, description, permissions }
        });
        return res.json({
            success: true,
            message: 'Role updated successfully',
            data: rObj || { id, company_id: companyId, name, description, permissions: buildPermObjects(permissions || []) }
        });
    }
    catch (error) {
        next(error);
    }
}
