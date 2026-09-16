"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const rbac_middleware_js_1 = require("../middleware/rbac.middleware.js");
const constants_1 = require("@construction/constants");
const authController = __importStar(require("../modules/auth/auth.controller.js"));
const employeeController = __importStar(require("../modules/employees/employees.controller.js"));
const roleController = __importStar(require("../modules/roles/roles.controller.js"));
const attendanceController = __importStar(require("../modules/attendance/attendance.controller.js"));
const leaveController = __importStar(require("../modules/leave/leave.controller.js"));
const holidayController = __importStar(require("../modules/holidays/holidays.controller.js"));
const productController = __importStar(require("../modules/products/products.controller.js"));
const supplierController = __importStar(require("../modules/suppliers/suppliers.controller.js"));
const purchaseController = __importStar(require("../modules/purchases/purchases.controller.js"));
const expenseController = __importStar(require("../modules/expenses/expenses.controller.js"));
const reportController = __importStar(require("../modules/reports/reports.controller.js"));
const auditController = __importStar(require("../modules/audit/audit.controller.js"));
const dashboardController = __importStar(require("../modules/dashboard/dashboard.controller.js"));
const chatController = __importStar(require("../modules/chat/chat.controller.js"));
const siteController = __importStar(require("../modules/sites/sites.controller.js"));
const financeController = __importStar(require("../modules/finance/finance.controller.js"));
const productRequestController = __importStar(require("../modules/product_requests/product_requests.controller.js"));
const inventoryController = __importStar(require("../modules/inventory/inventory.controller.js"));
const router = (0, express_1.Router)();
// Public / Auth Routes
router.post('/auth/login', authController.login);
router.get('/auth/me', auth_middleware_js_1.authenticateToken, authController.getMe);
router.post('/auth/logout', auth_middleware_js_1.authenticateToken, authController.logout);
// Employees API
router.get('/employees', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.EMPLOYEE_VIEW), employeeController.getEmployees);
router.get('/employees/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.EMPLOYEE_VIEW), employeeController.getEmployeeById);
router.post('/employees', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.EMPLOYEE_CREATE), employeeController.createEmployee);
router.patch('/employees/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.EMPLOYEE_EDIT), employeeController.updateEmployee);
router.post('/employees/:id/reset-password', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.EMPLOYEE_EDIT), employeeController.resetPassword);
// Roles & Permissions API
router.get('/permissions', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.ROLE_VIEW), roleController.getPermissions);
router.get('/roles', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.ROLE_VIEW), roleController.getRoles);
router.get('/roles/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.ROLE_VIEW), roleController.getRoleById);
router.post('/roles', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.ROLE_CREATE), roleController.createRole);
router.put('/roles/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.ROLE_EDIT), roleController.updateRole);
router.patch('/roles/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.ROLE_EDIT), roleController.updateRole);
// Attendance API
router.get('/attendance', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.ATTENDANCE_VIEW), attendanceController.getAttendance);
router.post('/attendance', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.ATTENDANCE_EDIT), attendanceController.recordAttendance);
// Leave API
router.get('/leave-types', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.LEAVE_VIEW), leaveController.getLeaveTypes);
router.post('/leave-types', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.LEAVE_APPROVE), leaveController.createLeaveType);
router.get('/leave/balances', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.LEAVE_VIEW), leaveController.getLeaveBalances);
router.get('/leave/requests', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.LEAVE_VIEW), leaveController.getLeaveRequests);
router.post('/leave/requests', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.LEAVE_REQUEST), leaveController.submitLeaveRequest);
router.patch('/leave/requests/:id/approval', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.LEAVE_APPROVE), leaveController.processLeaveApproval);
// Holidays API
router.get('/holidays', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.HOLIDAY_VIEW), holidayController.getHolidays);
router.post('/holidays', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.HOLIDAY_CREATE), holidayController.createHoliday);
router.delete('/holidays/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.HOLIDAY_DELETE), holidayController.deleteHoliday);
// Products API
router.get('/product-categories', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.PRODUCT_VIEW), productController.getProductCategories);
router.get('/products', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.PRODUCT_VIEW), productController.getProducts);
router.post('/products', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.PRODUCT_CREATE), productController.createProduct);
router.patch('/products/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.PRODUCT_EDIT), productController.updateProduct);
// Suppliers API
router.get('/suppliers', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.SUPPLIER_VIEW), supplierController.getSuppliers);
router.get('/suppliers/check-duplicate', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.SUPPLIER_CREATE), supplierController.checkSupplierDuplicate);
router.get('/suppliers/:id/history', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.SUPPLIER_VIEW), supplierController.getSupplierHistory);
router.post('/suppliers', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.SUPPLIER_CREATE), supplierController.createSupplier);
// Purchases API
router.get('/purchases', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.PURCHASE_VIEW), purchaseController.getPurchases);
router.get('/purchases/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.PURCHASE_VIEW), purchaseController.getPurchaseById);
router.post('/purchases', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.PURCHASE_CREATE), purchaseController.createPurchase);
router.patch('/purchases/:id/payment', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.PURCHASE_EDIT), purchaseController.updatePurchasePayment);
// Expenses API
router.get('/expenses', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.EXPENSE_VIEW), expenseController.getExpenses);
router.post('/expenses', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.EXPENSE_CREATE), expenseController.createExpense);
// Audit Logs API
router.get('/audit-logs', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.AUDIT_LOG_VIEW), auditController.getAuditLogs);
// Reports API
router.get('/reports/purchases', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.REPORT_VIEW), reportController.getPurchaseSummaryReport);
router.get('/reports/expenses', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.REPORT_VIEW), reportController.getExpenseSummaryReport);
// Dashboard API
router.get('/dashboard/admin', auth_middleware_js_1.authenticateToken, dashboardController.getAdminDashboard);
// Team Chat API
router.get('/chat/contacts', auth_middleware_js_1.authenticateToken, chatController.getChatContacts);
router.get('/chat/rooms', auth_middleware_js_1.authenticateToken, chatController.getChatRooms);
router.post('/chat/rooms', auth_middleware_js_1.authenticateToken, chatController.createOrGetDirectRoom);
router.get('/chat/rooms/:roomId/messages', auth_middleware_js_1.authenticateToken, chatController.getRoomMessages);
router.post('/chat/rooms/:roomId/messages', auth_middleware_js_1.authenticateToken, chatController.sendMessage);
// Construction Sites API
router.get('/sites', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.SITE_VIEW), siteController.getSites);
router.get('/sites/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.SITE_VIEW), siteController.getSiteById);
router.post('/sites', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.SITE_CREATE), siteController.createSite);
router.patch('/sites/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.SITE_EDIT), siteController.updateSite);
router.delete('/sites/:id', auth_middleware_js_1.authenticateToken, (0, rbac_middleware_js_1.requirePermission)(constants_1.PERMISSIONS.SITE_DELETE), siteController.deleteSite);
// Accountant & Finance API
router.get('/finance/documents', auth_middleware_js_1.authenticateToken, financeController.getFinancialDocuments);
router.post('/finance/documents', auth_middleware_js_1.authenticateToken, financeController.createFinancialDocument);
router.patch('/finance/documents/:id/status', auth_middleware_js_1.authenticateToken, financeController.updateFinancialDocStatus);
router.get('/finance/summary', auth_middleware_js_1.authenticateToken, financeController.getFinanceSummary);
// Product Requests API
router.get('/product-requests', auth_middleware_js_1.authenticateToken, productRequestController.getProductRequests);
router.post('/product-requests', auth_middleware_js_1.authenticateToken, productRequestController.createProductRequest);
router.patch('/product-requests/:id/status', auth_middleware_js_1.authenticateToken, productRequestController.updateProductRequestStatus);
// Inventory Management API
router.get('/inventory', auth_middleware_js_1.authenticateToken, inventoryController.getInventoryOverview);
router.post('/inventory/usage', auth_middleware_js_1.authenticateToken, inventoryController.recordMaterialUsage);
router.post('/inventory/damaged', auth_middleware_js_1.authenticateToken, inventoryController.reportDamagedMaterial);
router.get('/inventory/transfers', auth_middleware_js_1.authenticateToken, inventoryController.getMaterialTransfers);
router.post('/inventory/transfers', auth_middleware_js_1.authenticateToken, inventoryController.createMaterialTransfer);
router.patch('/inventory/transfers/:id/status', auth_middleware_js_1.authenticateToken, inventoryController.updateMaterialTransferStatus);
router.get('/inventory/transactions', auth_middleware_js_1.authenticateToken, inventoryController.getInventoryTransactions);
exports.default = router;
