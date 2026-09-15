import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { PERMISSIONS } from '@construction/constants';

import * as authController from '../modules/auth/auth.controller.js';
import * as employeeController from '../modules/employees/employees.controller.js';
import * as roleController from '../modules/roles/roles.controller.js';
import * as attendanceController from '../modules/attendance/attendance.controller.js';
import * as leaveController from '../modules/leave/leave.controller.js';
import * as holidayController from '../modules/holidays/holidays.controller.js';
import * as productController from '../modules/products/products.controller.js';
import * as supplierController from '../modules/suppliers/suppliers.controller.js';
import * as purchaseController from '../modules/purchases/purchases.controller.js';
import * as expenseController from '../modules/expenses/expenses.controller.js';
import * as reportController from '../modules/reports/reports.controller.js';
import * as auditController from '../modules/audit/audit.controller.js';
import * as dashboardController from '../modules/dashboard/dashboard.controller.js';
import * as chatController from '../modules/chat/chat.controller.js';
import * as siteController from '../modules/sites/sites.controller.js';
import * as financeController from '../modules/finance/finance.controller.js';
import * as productRequestController from '../modules/product_requests/product_requests.controller.js';
import * as inventoryController from '../modules/inventory/inventory.controller.js';

const router = Router();

// Public / Auth Routes
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);
router.post('/auth/logout', authenticateToken, authController.logout);

// Employees API
router.get('/employees', authenticateToken, requirePermission(PERMISSIONS.EMPLOYEE_VIEW), employeeController.getEmployees);
router.get('/employees/:id', authenticateToken, requirePermission(PERMISSIONS.EMPLOYEE_VIEW), employeeController.getEmployeeById);
router.post('/employees', authenticateToken, requirePermission(PERMISSIONS.EMPLOYEE_CREATE), employeeController.createEmployee);
router.patch('/employees/:id', authenticateToken, requirePermission(PERMISSIONS.EMPLOYEE_EDIT), employeeController.updateEmployee);
router.post('/employees/:id/reset-password', authenticateToken, requirePermission(PERMISSIONS.EMPLOYEE_EDIT), employeeController.resetPassword);

// Roles & Permissions API
router.get('/permissions', authenticateToken, requirePermission(PERMISSIONS.ROLE_VIEW), roleController.getPermissions);
router.get('/roles', authenticateToken, requirePermission(PERMISSIONS.ROLE_VIEW), roleController.getRoles);
router.get('/roles/:id', authenticateToken, requirePermission(PERMISSIONS.ROLE_VIEW), roleController.getRoleById);
router.post('/roles', authenticateToken, requirePermission(PERMISSIONS.ROLE_CREATE), roleController.createRole);
router.put('/roles/:id', authenticateToken, requirePermission(PERMISSIONS.ROLE_EDIT), roleController.updateRole);
router.patch('/roles/:id', authenticateToken, requirePermission(PERMISSIONS.ROLE_EDIT), roleController.updateRole);

// Attendance API
router.get('/attendance', authenticateToken, requirePermission(PERMISSIONS.ATTENDANCE_VIEW), attendanceController.getAttendance);
router.post('/attendance', authenticateToken, requirePermission(PERMISSIONS.ATTENDANCE_EDIT), attendanceController.recordAttendance);

// Leave API
router.get('/leave-types', authenticateToken, requirePermission(PERMISSIONS.LEAVE_VIEW), leaveController.getLeaveTypes);
router.post('/leave-types', authenticateToken, requirePermission(PERMISSIONS.LEAVE_APPROVE), leaveController.createLeaveType);
router.get('/leave/balances', authenticateToken, requirePermission(PERMISSIONS.LEAVE_VIEW), leaveController.getLeaveBalances);
router.get('/leave/requests', authenticateToken, requirePermission(PERMISSIONS.LEAVE_VIEW), leaveController.getLeaveRequests);
router.post('/leave/requests', authenticateToken, requirePermission(PERMISSIONS.LEAVE_REQUEST), leaveController.submitLeaveRequest);
router.patch('/leave/requests/:id/approval', authenticateToken, requirePermission(PERMISSIONS.LEAVE_APPROVE), leaveController.processLeaveApproval);

// Holidays API
router.get('/holidays', authenticateToken, requirePermission(PERMISSIONS.HOLIDAY_VIEW), holidayController.getHolidays);
router.post('/holidays', authenticateToken, requirePermission(PERMISSIONS.HOLIDAY_CREATE), holidayController.createHoliday);
router.delete('/holidays/:id', authenticateToken, requirePermission(PERMISSIONS.HOLIDAY_DELETE), holidayController.deleteHoliday);

// Products API
router.get('/product-categories', authenticateToken, requirePermission(PERMISSIONS.PRODUCT_VIEW), productController.getProductCategories);
router.get('/products', authenticateToken, requirePermission(PERMISSIONS.PRODUCT_VIEW), productController.getProducts);
router.post('/products', authenticateToken, requirePermission(PERMISSIONS.PRODUCT_CREATE), productController.createProduct);
router.patch('/products/:id', authenticateToken, requirePermission(PERMISSIONS.PRODUCT_EDIT), productController.updateProduct);

// Suppliers API
router.get('/suppliers', authenticateToken, requirePermission(PERMISSIONS.SUPPLIER_VIEW), supplierController.getSuppliers);
router.get('/suppliers/check-duplicate', authenticateToken, requirePermission(PERMISSIONS.SUPPLIER_CREATE), supplierController.checkSupplierDuplicate);
router.get('/suppliers/:id/history', authenticateToken, requirePermission(PERMISSIONS.SUPPLIER_VIEW), supplierController.getSupplierHistory);
router.post('/suppliers', authenticateToken, requirePermission(PERMISSIONS.SUPPLIER_CREATE), supplierController.createSupplier);

// Purchases API
router.get('/purchases', authenticateToken, requirePermission(PERMISSIONS.PURCHASE_VIEW), purchaseController.getPurchases);
router.get('/purchases/:id', authenticateToken, requirePermission(PERMISSIONS.PURCHASE_VIEW), purchaseController.getPurchaseById);
router.post('/purchases', authenticateToken, requirePermission(PERMISSIONS.PURCHASE_CREATE), purchaseController.createPurchase);
router.patch('/purchases/:id/payment', authenticateToken, requirePermission(PERMISSIONS.PURCHASE_EDIT), purchaseController.updatePurchasePayment);

// Expenses API
router.get('/expenses', authenticateToken, requirePermission(PERMISSIONS.EXPENSE_VIEW), expenseController.getExpenses);
router.post('/expenses', authenticateToken, requirePermission(PERMISSIONS.EXPENSE_CREATE), expenseController.createExpense);

// Audit Logs API
router.get('/audit-logs', authenticateToken, requirePermission(PERMISSIONS.AUDIT_LOG_VIEW), auditController.getAuditLogs);

// Reports API
router.get('/reports/purchases', authenticateToken, requirePermission(PERMISSIONS.REPORT_VIEW), reportController.getPurchaseSummaryReport);
router.get('/reports/expenses', authenticateToken, requirePermission(PERMISSIONS.REPORT_VIEW), reportController.getExpenseSummaryReport);

// Dashboard API
router.get('/dashboard/admin', authenticateToken, dashboardController.getAdminDashboard);

// Team Chat API
router.get('/chat/contacts', authenticateToken, chatController.getChatContacts);
router.get('/chat/rooms', authenticateToken, chatController.getChatRooms);
router.post('/chat/rooms', authenticateToken, chatController.createOrGetDirectRoom);
router.get('/chat/rooms/:roomId/messages', authenticateToken, chatController.getRoomMessages);
router.post('/chat/rooms/:roomId/messages', authenticateToken, chatController.sendMessage);

// Construction Sites API
router.get('/sites', authenticateToken, requirePermission(PERMISSIONS.SITE_VIEW), siteController.getSites);
router.get('/sites/:id', authenticateToken, requirePermission(PERMISSIONS.SITE_VIEW), siteController.getSiteById);
router.post('/sites', authenticateToken, requirePermission(PERMISSIONS.SITE_CREATE), siteController.createSite);
router.patch('/sites/:id', authenticateToken, requirePermission(PERMISSIONS.SITE_EDIT), siteController.updateSite);
router.delete('/sites/:id', authenticateToken, requirePermission(PERMISSIONS.SITE_DELETE), siteController.deleteSite);

// Accountant & Finance API
router.get('/finance/documents', authenticateToken, financeController.getFinancialDocuments);
router.post('/finance/documents', authenticateToken, financeController.createFinancialDocument);
router.patch('/finance/documents/:id/status', authenticateToken, financeController.updateFinancialDocStatus);
router.get('/finance/summary', authenticateToken, financeController.getFinanceSummary);

// Product Requests API
router.get('/product-requests', authenticateToken, productRequestController.getProductRequests);
router.post('/product-requests', authenticateToken, productRequestController.createProductRequest);
router.patch('/product-requests/:id/status', authenticateToken, productRequestController.updateProductRequestStatus);

// Inventory Management API
router.get('/inventory', authenticateToken, inventoryController.getInventoryOverview);
router.post('/inventory/usage', authenticateToken, inventoryController.recordMaterialUsage);
router.post('/inventory/damaged', authenticateToken, inventoryController.reportDamagedMaterial);
router.get('/inventory/transfers', authenticateToken, inventoryController.getMaterialTransfers);
router.post('/inventory/transfers', authenticateToken, inventoryController.createMaterialTransfer);
router.patch('/inventory/transfers/:id/status', authenticateToken, inventoryController.updateMaterialTransferStatus);
router.get('/inventory/transactions', authenticateToken, inventoryController.getInventoryTransactions);

export default router;
