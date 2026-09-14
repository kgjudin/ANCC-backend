import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { ENV } from './env.js';
import { ALL_PERMISSIONS } from '@construction/constants';

const { Pool } = pg;

// PostgreSQL Connection Pool
export const pool = new Pool({
  connectionString: ENV.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Supabase Admin Client (Service Role - Server Only)
export const supabaseAdmin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

let useInMemoryFallback = false;

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

export const memoryStore = {
  users: [
    { id: '40000000-0000-0000-0000-000000000001', email: 'admin@construction.com', company_id: '00000000-0000-0000-0000-000000000001', status: 'Active' },
    { id: '40000000-0000-0000-0000-000000000002', email: 'hr@construction.com', company_id: '00000000-0000-0000-0000-000000000001', status: 'Active' },
    { id: '40000000-0000-0000-0000-000000000003', email: 'purchase@construction.com', company_id: '00000000-0000-0000-0000-000000000001', status: 'Active' },
    { id: '40000000-0000-0000-0000-000000000004', email: 'employee@construction.com', company_id: '00000000-0000-0000-0000-000000000001', status: 'Active' }
  ],
  employees: [
    {
      id: '50000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-0001',
      user_id: '40000000-0000-0000-0000-000000000001',
      company_id: '00000000-0000-0000-0000-000000000001',
      full_name: 'System Administrator',
      email: 'admin@construction.com',
      phone: '+919876543210',
      department_name: 'Management',
      designation_name: 'Managing Director',
      role_id: '10000000-0000-0000-0000-000000000001',
      role_name: 'Super Admin',
      joining_date: '2026-01-01',
      status: 'Active',
      emp_status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: '50000000-0000-0000-0000-000000000002',
      employee_code: 'EMP-0002',
      user_id: '40000000-0000-0000-0000-000000000002',
      company_id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Anil Sharma (HR)',
      email: 'hr@construction.com',
      phone: '+919876543211',
      department_name: 'Human Resources',
      designation_name: 'HR Lead',
      role_id: '10000000-0000-0000-0000-000000000002',
      role_name: 'HR Manager',
      joining_date: '2026-01-15',
      status: 'Active',
      emp_status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: '50000000-0000-0000-0000-000000000003',
      employee_code: 'EMP-0003',
      user_id: '40000000-0000-0000-0000-000000000003',
      company_id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Rahul Kumar (Purchase)',
      email: 'purchase@construction.com',
      phone: '+919876543212',
      department_name: 'Procurement & Purchase',
      designation_name: 'Purchase Officer',
      role_id: '10000000-0000-0000-0000-000000000003',
      role_name: 'Purchase Executive',
      joining_date: '2026-02-01',
      status: 'Active',
      emp_status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: '50000000-0000-0000-0000-000000000004',
      employee_code: 'EMP-0004',
      user_id: '40000000-0000-0000-0000-000000000004',
      company_id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Vikram Singh (Engineer)',
      email: 'employee@construction.com',
      phone: '+919876543213',
      department_name: 'Site Operations',
      designation_name: 'Site Engineer',
      role_id: '10000000-0000-0000-0000-000000000004',
      role_name: 'Employee',
      joining_date: '2026-02-15',
      status: 'Active',
      emp_status: 'Active',
      created_at: new Date().toISOString()
    }
  ],
  roles: [
    {
      id: '10000000-0000-0000-0000-000000000001',
      company_id: '00000000-0000-0000-0000-000000000001',
      name: 'Super Admin',
      description: 'Full system access across all modules',
      is_system: true,
      permissions: ALL_PERMISSIONS.map((k) => ({
        key: k,
        module: PERM_DESCRIPTIONS[k]?.module || k.split('.')[0],
        description: PERM_DESCRIPTIONS[k]?.description || k
      }))
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      company_id: '00000000-0000-0000-0000-000000000001',
      name: 'HR Manager',
      description: 'Manage employees, attendance, leave, and holidays',
      is_system: true,
      permissions: ALL_PERMISSIONS.filter((k) => ['employee', 'attendance', 'leave', 'holiday'].includes(k.split('.')[0])).map((k) => ({
        key: k,
        module: PERM_DESCRIPTIONS[k]?.module || k.split('.')[0],
        description: PERM_DESCRIPTIONS[k]?.description || k
      }))
    },
    {
      id: '10000000-0000-0000-0000-000000000003',
      company_id: '00000000-0000-0000-0000-000000000001',
      name: 'Purchase Executive',
      description: 'Manage suppliers, products, purchases, and expenses',
      is_system: true,
      permissions: ALL_PERMISSIONS.filter((k) => ['supplier', 'product', 'purchase', 'expense'].includes(k.split('.')[0])).map((k) => ({
        key: k,
        module: PERM_DESCRIPTIONS[k]?.module || k.split('.')[0],
        description: PERM_DESCRIPTIONS[k]?.description || k
      }))
    },
    {
      id: '10000000-0000-0000-0000-000000000004',
      company_id: '00000000-0000-0000-0000-000000000001',
      name: 'Employee',
      description: 'Standard employee self-service access',
      is_system: true,
      permissions: ALL_PERMISSIONS.filter((k) => ['attendance.view', 'leave.view', 'leave.request'].includes(k)).map((k) => ({
        key: k,
        module: PERM_DESCRIPTIONS[k]?.module || k.split('.')[0],
        description: PERM_DESCRIPTIONS[k]?.description || k
      }))
    }
  ],
  permissions: ALL_PERMISSIONS.map((k, idx) => ({
    id: `perm-${idx}`,
    key: k,
    module: PERM_DESCRIPTIONS[k]?.module || k.split('.')[0],
    description: PERM_DESCRIPTIONS[k]?.description || k
  })),
  attendance: [
    {
      id: 'att-1',
      employee_id: '50000000-0000-0000-0000-000000000001',
      employee_name: 'System Administrator',
      employee_code: 'EMP-0001',
      date: new Date().toISOString().split('T')[0],
      check_in: '09:00',
      check_out: '18:00',
      total_hours: 9,
      status: 'Present',
      notes: 'On-site Admin'
    }
  ],
  leave_types: [
    { id: '60000000-0000-0000-0000-000000000001', company_id: '00000000-0000-0000-0000-000000000001', name: 'Casual Leave', allocated_days: 12, year: 2026, status: 'Active' },
    { id: '60000000-0000-0000-0000-000000000002', company_id: '00000000-0000-0000-0000-000000000001', name: 'Sick Leave', allocated_days: 10, year: 2026, status: 'Active' },
    { id: '60000000-0000-0000-0000-000000000003', company_id: '00000000-0000-0000-0000-000000000001', name: 'Earned Leave', allocated_days: 15, year: 2026, status: 'Active' }
  ],
  employee_leave_balances: [
    { id: 'elb-1', employee_id: '50000000-0000-0000-0000-000000000001', leave_type_id: '60000000-0000-0000-0000-000000000001', leave_type_name: 'Casual Leave', year: 2026, allocated_days: 12, used_days: 0, remaining_days: 12 }
  ],
  leave_requests: [] as any[],
  holidays: [
    { id: 'hol-1', company_id: '00000000-0000-0000-0000-000000000001', name: 'New Year Day', date: '2026-01-01', year: 2026, holiday_type: 'Public', description: 'New Year' }
  ],
  product_categories: [
    { id: '70000000-0000-0000-0000-000000000001', company_id: '00000000-0000-0000-0000-000000000001', name: 'Cement & Concrete' },
    { id: '70000000-0000-0000-0000-000000000002', company_id: '00000000-0000-0000-0000-000000000001', name: 'Steel & Metals' }
  ],
  products: [
    { id: '80000000-0000-0000-0000-000000000001', product_code: 'PRD-0001', company_id: '00000000-0000-0000-0000-000000000001', name: 'OPC 53 Grade Cement', category_id: '70000000-0000-0000-0000-000000000001', category_name: 'Cement & Concrete', unit: 'Bags', standard_rate: 420.00, description: 'High strength cement' },
    { id: '80000000-0000-0000-0000-000000000002', product_code: 'PRD-0002', company_id: '00000000-0000-0000-0000-000000000001', name: 'TMT Rebar 12mm', category_id: '70000000-0000-0000-0000-000000000002', category_name: 'Steel & Metals', unit: 'KG', standard_rate: 68.50, description: 'Fe 550D rebar' }
  ],
  suppliers: [
    { id: '90000000-0000-0000-0000-000000000001', supplier_code: 'SUP-00001', company_id: '00000000-0000-0000-0000-000000000001', company_name: 'ABC Building Materials Pvt Ltd', contact_person: 'Ramesh Shah', phone: '+919876500001', email: 'abc@materials.com', gst_number: '29ABCDE1234F1Z5', registered_by_name: 'Rahul Kumar (Purchase)' }
  ],
  purchases: [
    { id: 'pur-1', purchase_number: 'PUR-00001', company_id: '00000000-0000-0000-0000-000000000001', supplier_id: '90000000-0000-0000-0000-000000000001', supplier_name: 'ABC Building Materials Pvt Ltd', purchase_date: '2026-03-01', subtotal: 4200, grand_total: 4200, paid_amount: 4200, outstanding_amount: 0, payment_status: 'Paid', created_by_name: 'Rahul Kumar (Purchase)', created_at: new Date().toISOString() }
  ],
  purchase_items: [
    { id: 'pi-1', purchase_id: 'pur-1', product_id: '80000000-0000-0000-0000-000000000001', product_name: 'OPC 53 Grade Cement', quantity: 10, unit: 'Bags', unit_rate: 420, line_total: 4200, quality_status: 'Approved' }
  ],
  expenses: [
    { id: 'exp-1', company_id: '00000000-0000-0000-0000-000000000001', category: 'Material', amount: 4200, date: '2026-03-01', description: 'Initial cement procurement', created_by_name: 'Rahul Kumar (Purchase)' }
  ],
  audit_logs: [
    { id: 'aud-1', actor_employee_id: '50000000-0000-0000-0000-000000000001', actor_employee_name: 'System Administrator', action: 'LOGIN', module: 'Auth', entity_type: 'User', timestamp: new Date().toISOString() }
  ],
  chat_rooms: [
    { id: 'c0000000-0000-0000-0000-000000000001', company_id: '00000000-0000-0000-0000-000000000001', name: 'General Site Operations', type: 'group', created_at: new Date().toISOString() }
  ],
  chat_members: [
    { room_id: 'c0000000-0000-0000-0000-000000000001', user_id: '40000000-0000-0000-0000-000000000001' },
    { room_id: 'c0000000-0000-0000-0000-000000000001', user_id: '40000000-0000-0000-0000-000000000002' },
    { room_id: 'c0000000-0000-0000-0000-000000000001', user_id: '40000000-0000-0000-0000-000000000003' },
    { room_id: 'c0000000-0000-0000-0000-000000000001', user_id: '40000000-0000-0000-0000-000000000004' }
  ],
  messages: [
    { id: 'm0000000-0000-0000-0000-000000000001', room_id: 'c0000000-0000-0000-0000-000000000001', sender_user_id: '40000000-0000-0000-0000-000000000001', sender_name: 'System Administrator', content: 'Welcome to the team chat channel! All staff can chat here.', created_at: new Date().toISOString() }
  ],
  sites: [
    {
      id: 's0000000-0000-0000-0000-000000000001',
      site_code: 'SITE-0001',
      company_id: '00000000-0000-0000-0000-000000000001',
      name: 'Main City Tower Project',
      location: 'Downtown Commercial District, Block B',
      site_manager_id: '50000000-0000-0000-0000-000000000004',
      site_manager_name: 'Vikram Singh (Engineer)',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 's0000000-0000-0000-0000-000000000002',
      site_code: 'SITE-0002',
      company_id: '00000000-0000-0000-0000-000000000001',
      name: 'Metro Expressway Flyover',
      location: 'Sector 14 North Highway',
      site_manager_id: '50000000-0000-0000-0000-000000000001',
      site_manager_name: 'System Administrator',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 's0000000-0000-0000-0000-000000000003',
      site_code: 'SITE-0003',
      company_id: '00000000-0000-0000-0000-000000000001',
      name: 'Green Valley Residency',
      location: 'Palm Avenue, Phase 2',
      site_manager_id: '50000000-0000-0000-0000-000000000003',
      site_manager_name: 'Rahul Kumar (Purchase)',
      status: 'On Hold',
      created_at: new Date().toISOString()
    }
  ],
  financial_documents: [
    {
      id: 'fin-10001',
      invoice_no: 'INV-20260914-001',
      company_id: '00000000-0000-0000-0000-000000000001',
      site_id: 's0000000-0000-0000-0000-000000000001',
      site_name: 'Main City Tower Project',
      vendor_name: 'ABC Building Materials Pvt Ltd',
      date: '2026-09-14',
      items: [
        { description: 'OPC 53 Grade Cement', quantity: 100, unit_price: 420, amount: 42000 },
        { description: 'TMT Rebar 12mm Steel', quantity: 50, unit_price: 200, amount: 10000 }
      ],
      subtotal: 52000,
      tax: 2600,
      discount: 1000,
      total: 53600,
      status: 'Approved',
      admin_remarks: 'Verified material delivery receipt',
      created_by: '50000000-0000-0000-0000-000000000003',
      created_by_name: 'Rahul Kumar (Purchase)',
      approved_by_name: 'System Administrator',
      created_at: new Date().toISOString()
    },
    {
      id: 'fin-10002',
      invoice_no: 'INV-20260914-002',
      company_id: '00000000-0000-0000-0000-000000000001',
      site_id: 's0000000-0000-0000-0000-000000000002',
      site_name: 'Metro Expressway Flyover',
      vendor_name: 'Apex Steel & Structures',
      date: '2026-09-14',
      items: [
        { description: 'Structural Steel Beams', quantity: 10, unit_price: 1500, amount: 15000 }
      ],
      subtotal: 15000,
      tax: 750,
      discount: 0,
      total: 15750,
      status: 'Pending',
      admin_remarks: '',
      created_by: '50000000-0000-0000-0000-000000000003',
      created_by_name: 'Rahul Kumar (Purchase)',
      created_at: new Date().toISOString()
    }
  ],
  product_requests: [
    {
      id: 'prq-10001',
      request_code: 'REQ-0001',
      company_id: '00000000-0000-0000-0000-000000000001',
      site_id: 's0000000-0000-0000-0000-000000000001',
      site_name: 'Main City Tower Project',
      product_id: '80000000-0000-0000-0000-000000000001',
      product_name: 'OPC 53 Grade Cement',
      category: 'Cement & Concrete',
      quantity: 50,
      unit: 'Bags',
      required_date: '2026-03-20',
      priority: 'High',
      reason: 'Urgent slab column casting work scheduled next week',
      requested_by: '50000000-0000-0000-0000-000000000004',
      requested_by_name: 'Vikram Singh (Engineer)',
      status: 'Approved',
      created_at: new Date().toISOString()
    },
    {
      id: 'prq-10002',
      request_code: 'REQ-0002',
      company_id: '00000000-0000-0000-0000-000000000001',
      site_id: 's0000000-0000-0000-0000-000000000002',
      site_name: 'Metro Expressway Flyover',
      product_id: '80000000-0000-0000-0000-000000000002',
      product_name: 'TMT Rebar 12mm',
      category: 'Steel & Metals',
      quantity: 250,
      unit: 'KG',
      required_date: '2026-03-22',
      priority: 'Urgent',
      reason: 'Reinforcement mesh binding for pier structure',
      requested_by: '50000000-0000-0000-0000-000000000004',
      requested_by_name: 'Vikram Singh (Engineer)',
      status: 'Pending',
      created_at: new Date().toISOString()
    }
  ],
  inventory: [
    {
      id: 'inv-10001',
      company_id: '00000000-0000-0000-0000-000000000001',
      site_id: 's0000000-0000-0000-0000-000000000001',
      site_name: 'Main City Tower Project',
      product_id: '80000000-0000-0000-0000-000000000001',
      product_name: 'OPC 53 Grade Cement',
      product_code: 'PRD-0001',
      category_name: 'Cement & Concrete',
      opening_stock: 500,
      received_qty: 300,
      transferred_in_qty: 0,
      used_qty: 450,
      damaged_qty: 20,
      unwanted_qty: 10,
      transferred_out_qty: 0,
      current_balance: 320,
      min_stock_level: 100,
      unit: 'Bags',
      updated_at: new Date().toISOString()
    },
    {
      id: 'inv-10002',
      company_id: '00000000-0000-0000-0000-000000000001',
      site_id: 's0000000-0000-0000-0000-000000000001',
      site_name: 'Main City Tower Project',
      product_id: '80000000-0000-0000-0000-000000000002',
      product_name: 'TMT Rebar 12mm',
      product_code: 'PRD-0002',
      category_name: 'Steel & Metals',
      opening_stock: 1000,
      received_qty: 500,
      transferred_in_qty: 0,
      used_qty: 1350,
      damaged_qty: 30,
      unwanted_qty: 0,
      transferred_out_qty: 50,
      current_balance: 70,
      min_stock_level: 200,
      unit: 'KG',
      updated_at: new Date().toISOString()
    }
  ],
  inventory_transactions: [
    {
      id: 'itx-10001',
      company_id: '00000000-0000-0000-0000-000000000001',
      site_id: 's0000000-0000-0000-0000-000000000001',
      site_name: 'Main City Tower Project',
      product_id: '80000000-0000-0000-0000-000000000001',
      product_name: 'OPC 53 Grade Cement',
      quantity: 300,
      unit: 'Bags',
      transaction_type: 'Material Received',
      notes: 'Initial material stock delivery from supplier',
      created_by_name: 'System Administrator',
      created_at: new Date().toISOString()
    }
  ],
  material_usage: [],
  damaged_materials: [],
  unwanted_materials: [],
  material_transfers: [
    {
      id: 'trf-10001',
      transfer_code: 'TRF-0001',
      company_id: '00000000-0000-0000-0000-000000000001',
      from_site_id: 's0000000-0000-0000-0000-000000000001',
      from_site_name: 'Main City Tower Project',
      to_site_id: 's0000000-0000-0000-0000-000000000002',
      to_site_name: 'Metro Expressway Flyover',
      product_id: '80000000-0000-0000-0000-000000000002',
      product_name: 'TMT Rebar 12mm',
      quantity: 50,
      unit: 'KG',
      reason: 'Urgent rebar requirement for flyover pier binding',
      status: 'Approved',
      requested_by: '50000000-0000-0000-0000-000000000004',
      requested_by_name: 'Vikram Singh (Engineer)',
      approved_by_name: 'System Administrator',
      transfer_date: '2026-03-14',
      created_at: new Date().toISOString()
    }
  ]
};

// Smart In-Memory SQL Query Emulator
function executeInMemoryQuery(text: string, params?: any[]): any[] {
  const sql = text.trim().toLowerCase();
  const p = params || [];

  // 1. Aggregation / Count Queries
  if (sql.includes('select count(*)')) {
    let countVal = 1;
    if (sql.includes('from employees')) countVal = memoryStore.employees.length;
    else if (sql.includes('from attendance')) countVal = memoryStore.attendance.length;
    else if (sql.includes('from leave_requests')) countVal = memoryStore.leave_requests.length;
    else if (sql.includes('from suppliers')) countVal = memoryStore.suppliers.length;
    else if (sql.includes('from purchases')) countVal = memoryStore.purchases.length;
    else if (sql.includes('from products')) countVal = memoryStore.products.length;
    else if (sql.includes('from expenses')) countVal = memoryStore.expenses.length;
    else if (sql.includes('from sites')) countVal = memoryStore.sites.length;
    return [{ total: countVal, cnt: countVal }];
  }

  if (sql.includes('sum(grand_total)')) {
    const totalP = memoryStore.purchases.reduce((acc, x) => acc + (Number(x.grand_total) || 0), 0);
    const totalPaid = memoryStore.purchases.reduce((acc, x) => acc + (Number(x.paid_amount) || 0), 0);
    const totalOut = memoryStore.purchases.reduce((acc, x) => acc + (Number(x.outstanding_amount) || 0), 0);
    return [{
      total_purchases: totalP,
      total_paid: totalPaid,
      total_outstanding: totalOut,
      total_purchases_count: memoryStore.purchases.length,
      total_grand_amount: totalP,
      total_paid_amount: totalPaid,
      total_outstanding_amount: totalOut
    }];
  }

  // 2. User & Employee Mutations
  if (sql.startsWith('insert into users')) {
    const newU = { id: p[0], email: p[1], company_id: p[2], status: 'Active' };
    memoryStore.users.push(newU);
    return [newU];
  }

  if (sql.startsWith('insert into user_roles')) {
    const userId = p[0];
    const roleId = p[1];
    const rObj = memoryStore.roles.find((r) => r.id === roleId) || memoryStore.roles[0];
    const emp = memoryStore.employees.find((e) => e.user_id === userId);
    if (emp) {
      emp.role_id = rObj.id;
      emp.role_name = rObj.name;
    }
    return [{ success: true }];
  }

  if (sql.startsWith('insert into employees')) {
    const seq = memoryStore.employees.length + 1;
    const code = p[1] || `EMP-${String(seq).padStart(4, '0')}`;
    const newEmp = {
      id: p[0] || crypto.randomUUID(),
      employee_code: code,
      user_id: p[2] || crypto.randomUUID(),
      company_id: p[3] || '00000000-0000-0000-0000-000000000001',
      full_name: p[4],
      phone: p[5],
      email: p[6],
      joining_date: p[9] || new Date().toISOString().split('T')[0],
      status: 'Active',
      emp_status: 'Active',
      role_id: '10000000-0000-0000-0000-000000000004',
      role_name: 'Employee',
      created_at: new Date().toISOString()
    };
    memoryStore.employees.unshift(newEmp as any);
    return [newEmp];
  }

  if (sql.startsWith('update employees')) {
    const targetId = p[7] || p[8];
    const emp = memoryStore.employees.find((e) => e.id === targetId);
    if (emp) {
      if (p[0]) emp.full_name = p[0];
      if (p[1]) emp.phone = p[1];
      if (p[4]) emp.status = p[4];
    }
    return emp ? [emp] : [];
  }

  // 3. Role Mutations
  if (sql.startsWith('insert into roles')) {
    const roleName = p[2] || '';
    const existingIdx = memoryStore.roles.findIndex(
      (r) => r.name.toLowerCase() === roleName.toLowerCase() || r.id === p[0]
    );
    const newRoleObj = {
      id: p[0] || (existingIdx >= 0 ? memoryStore.roles[existingIdx].id : crypto.randomUUID()),
      company_id: p[1] || '00000000-0000-0000-0000-000000000001',
      name: p[2],
      description: p[3],
      is_system: false,
      permissions: (p[4] || []).map((k: string) => ({
        key: k,
        module: PERM_DESCRIPTIONS[k]?.module || k.split('.')[0],
        description: PERM_DESCRIPTIONS[k]?.description || k
      }))
    };
    if (existingIdx >= 0) {
      memoryStore.roles[existingIdx] = newRoleObj as any;
    } else {
      memoryStore.roles.push(newRoleObj as any);
    }
    return [newRoleObj];
  }

  if (sql.startsWith('update roles')) {
    const targetRoleId = p[2] || p[3];
    const rObj = memoryStore.roles.find((r) => r.id === targetRoleId);
    if (rObj) {
      if (p[0]) rObj.name = p[0];
      if (p[1]) rObj.description = p[1];
    }
    return rObj ? [rObj] : [];
  }

  // 4. Product & Inventory Mutations
  if (sql.startsWith('insert into products')) {
    const seq = memoryStore.products.length + 1;
    const code = p[0] || `PRD-${String(seq).padStart(4, '0')}`;
    const catObj = memoryStore.product_categories.find((c) => c.id === p[3]);
    const newProd = {
      id: crypto.randomUUID(),
      product_code: code,
      company_id: p[1] || '00000000-0000-0000-0000-000000000001',
      name: p[2],
      category_id: p[3] || null,
      category_name: catObj?.name || 'General',
      unit: p[4],
      standard_rate: Number(p[5] || 0),
      description: p[6] || null,
      status: 'Active',
      created_at: new Date().toISOString()
    };
    memoryStore.products.unshift(newProd as any);
    return [newProd];
  }

  if (sql.startsWith('update products')) {
    const targetId = p[6];
    const prod = memoryStore.products.find((x) => x.id === targetId);
    if (prod) {
      prod.name = p[0];
      prod.category_id = p[1];
      const catObj = memoryStore.product_categories.find((c) => c.id === p[1]);
      prod.category_name = catObj?.name || 'General';
      prod.unit = p[2];
      prod.standard_rate = Number(p[3]);
      prod.description = p[4];
      return [prod];
    }
    return [];
  }

  if (sql.startsWith('insert into suppliers')) {
    const newSup = {
      id: crypto.randomUUID(),
      supplier_code: p[0],
      company_id: p[1],
      company_name: p[2],
      contact_person: p[3],
      phone: p[4],
      email: p[5],
      address: p[6],
      gst_number: p[7],
      notes: p[8],
      status: 'Active',
      registered_by_name: 'System Administrator',
      registered_date: new Date().toISOString()
    };
    memoryStore.suppliers.unshift(newSup as any);
    return [newSup];
  }

  if (sql.startsWith('insert into purchases')) {
    const supObj = memoryStore.suppliers.find((s) => s.id === p[3]);
    const newPur = {
      id: p[0] || crypto.randomUUID(),
      purchase_number: p[1],
      company_id: p[2],
      supplier_id: p[3],
      supplier_name: supObj?.company_name || 'ABC Building Materials Pvt Ltd',
      purchase_date: p[4],
      subtotal: p[5],
      transport_cost: p[6],
      other_charges: p[7],
      tax_amount: p[8],
      discount_amount: p[9],
      grand_total: p[10],
      paid_amount: p[11],
      outstanding_amount: p[12],
      payment_status: p[13],
      invoice_number: p[14],
      notes: p[15],
      created_by_name: 'System Administrator',
      created_at: new Date().toISOString()
    };
    memoryStore.purchases.unshift(newPur as any);
    return [newPur];
  }

  if (sql.startsWith('insert into purchase_items')) {
    const prodObj = memoryStore.products.find((pr) => pr.id === p[1]);
    const newItem = {
      id: crypto.randomUUID(),
      purchase_id: p[0],
      product_id: p[1],
      product_name: prodObj?.name || 'Material',
      quantity: p[2],
      unit: p[3],
      unit_rate: p[4],
      discount: p[5],
      tax: p[6],
      line_total: p[7],
      brand: p[8],
      grade: p[9],
      quality_status: p[10],
      quality_notes: p[11]
    };
    memoryStore.purchase_items.unshift(newItem as any);
    return [newItem];
  }

  if (sql.startsWith('insert into expenses')) {
    const supObj = memoryStore.suppliers.find((s) => s.id === p[4]);
    const newExp = {
      id: crypto.randomUUID(),
      company_id: p[0],
      category: p[1],
      amount: Number(p[2]),
      date: p[3],
      supplier_id: p[4] || null,
      supplier_name: supObj?.company_name || null,
      purchase_id: p[5] || null,
      description: p[6],
      receipt_url: p[7] || null,
      created_by_name: 'System Administrator',
      created_at: new Date().toISOString()
    };
    memoryStore.expenses.unshift(newExp as any);
    return [newExp];
  }

  if (sql.startsWith('insert into attendance')) {
    const empObj = memoryStore.employees.find((e) => e.id === p[0]);
    const existingIdx = memoryStore.attendance.findIndex((a) => a.employee_id === p[0] && a.date === p[1]);
    const newAtt = {
      id: crypto.randomUUID(),
      employee_id: p[0],
      employee_name: empObj?.full_name || 'System Administrator',
      employee_code: empObj?.employee_code || 'EMP-0001',
      date: p[1],
      check_in: p[2],
      check_out: p[3],
      total_hours: p[4],
      status: p[5],
      notes: p[6]
    };
    if (existingIdx >= 0) {
      memoryStore.attendance[existingIdx] = newAtt as any;
    } else {
      memoryStore.attendance.unshift(newAtt as any);
    }
    return [newAtt];
  }

  if (sql.startsWith('insert into leave_requests')) {
    const empObj = memoryStore.employees.find((e) => e.id === p[0]);
    const ltObj = memoryStore.leave_types.find((lt) => lt.id === p[1]);
    const newLeave = {
      id: crypto.randomUUID(),
      employee_id: p[0],
      employee_name: empObj?.full_name || 'System Administrator',
      leave_type_id: p[1],
      leave_type_name: ltObj?.name || 'Casual Leave',
      start_date: p[2],
      end_date: p[3],
      total_days: p[4],
      reason: p[5],
      status: 'Pending',
      created_at: new Date().toISOString()
    };
    memoryStore.leave_requests.unshift(newLeave as any);
    return [newLeave];
  }

  if (sql.startsWith('insert into holidays')) {
    const newHol = {
      id: crypto.randomUUID(),
      company_id: p[0],
      name: p[1],
      date: p[2],
      year: p[3],
      holiday_type: p[4],
      description: p[5]
    };
    memoryStore.holidays.unshift(newHol as any);
    return [newHol];
  }

  if (sql.startsWith('insert into leave_types')) {
    const newLt = {
      id: crypto.randomUUID(),
      company_id: p[0],
      name: p[1],
      allocated_days: p[2],
      year: p[3],
      status: 'Active'
    };
    memoryStore.leave_types.unshift(newLt as any);
    return [newLt];
  }

  if (sql.startsWith('insert into audit_logs')) {
    const empObj = memoryStore.employees.find((e) => e.id === p[1]);
    const newAudit = {
      id: crypto.randomUUID(),
      actor_user_id: p[0],
      actor_employee_id: p[1],
      actor_employee_name: empObj?.full_name || 'System Administrator',
      action: p[2],
      module: p[3],
      entity_type: p[4],
      entity_id: p[5],
      change_metadata: p[6],
      timestamp: new Date().toISOString()
    };
    memoryStore.audit_logs.unshift(newAudit as any);
    return [newAudit];
  }

  // 5. Select & Check Queries
  if (sql.includes('from users')) {
    if (sql.includes('lower(') || sql.includes('where email')) {
      const searchEmail = String(p[0] || '').toLowerCase();
      const matchedEmp = memoryStore.employees.find((e) => e.email.toLowerCase() === searchEmail);
      if (matchedEmp) {
        return [{
          id: matchedEmp.user_id,
          user_id: matchedEmp.user_id,
          email: matchedEmp.email,
          company_id: matchedEmp.company_id,
          status: 'Active',
          employee_id: matchedEmp.id,
          full_name: matchedEmp.full_name,
          emp_status: matchedEmp.status
        }];
      }
      return [];
    }

    // Generic select from users (e.g. Chat contacts list)
    return memoryStore.users.map((u) => {
      const emp = memoryStore.employees.find((e) => e.user_id === u.id || e.email.toLowerCase() === u.email.toLowerCase());
      return {
        id: emp?.id || u.id,
        user_id: u.id,
        email: u.email,
        full_name: emp?.full_name || u.email,
        phone: emp?.phone || '',
        department_name: emp?.department_name || 'Staff',
        designation_name: emp?.designation_name || 'Employee',
        status: emp?.status || u.status || 'Active'
      };
    });
  }

  if (sql.includes('from employees') && sql.includes('where e.user_id = $1')) {
    const userId = p[0];
    const emp = memoryStore.employees.find((e) => e.user_id === userId);
    return emp ? [emp] : [];
  }

  if (sql.includes('from employees')) {
    return memoryStore.employees;
  }

  // User Dynamic Permissions Check
  if (sql.includes('from permissions') || sql.includes('permissions p') || sql.includes('role_permissions')) {
    if (sql.includes('where ur.user_id') || sql.includes('ur.user_id = $1')) {
      const userId = p[0];
      const emp = memoryStore.employees.find((e) => e.user_id === userId);
      const rObj = memoryStore.roles.find((role) => role.id === emp?.role_id || role.name === emp?.role_name);
      const permList = rObj ? (rObj.permissions || []) : memoryStore.permissions;
      return permList.map((pItem: any) => ({
        key: typeof pItem === 'string' ? pItem : pItem.key
      }));
    }
  }

  // Roles Matcher
  if (sql.includes('from roles') || (sql.includes('roles r') && !sql.includes('role_permissions'))) {
    if (sql.includes('where ur.user_id')) {
      const userId = p[0];
      const emp = memoryStore.employees.find((e) => e.user_id === userId);
      const r = memoryStore.roles.find((role) => role.name === emp?.role_name || role.id === emp?.role_id) || memoryStore.roles[0];
      return [r];
    }

    return memoryStore.roles.map((r) => ({
      ...r,
      permissions: (r.permissions || []).map((pItem: any) => {
        const key = typeof pItem === 'string' ? pItem : pItem.key;
        return {
          id: pItem.id || key,
          key,
          module: PERM_DESCRIPTIONS[key]?.module || key.split('.')[0],
          description: PERM_DESCRIPTIONS[key]?.description || key
        };
      })
    }));
  }

  if (sql.includes('permissions')) {
    return memoryStore.permissions;
  }

  if (sql.includes('from attendance')) {
    return memoryStore.attendance;
  }

  if (sql.includes('from leave_types')) {
    return memoryStore.leave_types;
  }

  if (sql.includes('from employee_leave_balances')) {
    return memoryStore.employee_leave_balances;
  }

  if (sql.includes('from leave_requests')) {
    return memoryStore.leave_requests;
  }

  if (sql.includes('from holidays')) {
    return memoryStore.holidays;
  }

  if (sql.includes('from product_categories')) {
    return memoryStore.product_categories;
  }

  if (sql.includes('from products')) {
    return memoryStore.products;
  }

  if (sql.includes('from suppliers')) {
    return memoryStore.suppliers;
  }

  if (sql.includes('from purchases')) {
    return memoryStore.purchases;
  }

  if (sql.includes('from expenses')) {
    return memoryStore.expenses;
  }

  if (sql.startsWith('insert into chat_rooms')) {
    const newRoom = {
      id: p[0] || crypto.randomUUID(),
      company_id: p[1] || '00000000-0000-0000-0000-000000000001',
      name: p[2] || null,
      type: p[3] || 'direct',
      created_at: new Date().toISOString()
    };
    memoryStore.chat_rooms.unshift(newRoom as any);
    return [newRoom];
  }

  if (sql.startsWith('insert into chat_members')) {
    const newMember = { room_id: p[0], user_id: p[1], joined_at: new Date().toISOString() };
    memoryStore.chat_members.push(newMember);
    return [newMember];
  }

  if (sql.startsWith('insert into messages')) {
    const newMsg = {
      id: p[0] || crypto.randomUUID(),
      room_id: p[1],
      sender_user_id: p[2],
      sender_name: p[3],
      content: p[4],
      created_at: new Date().toISOString()
    };
    memoryStore.messages.push(newMsg as any);
    return [newMsg];
  }

  if (sql.includes('from chat_rooms')) {
    return memoryStore.chat_rooms;
  }

  if (sql.includes('from messages')) {
    if (sql.includes('where room_id')) {
      const targetRoomId = p[0];
      return memoryStore.messages.filter((m) => m.room_id === targetRoomId);
    }
    return memoryStore.messages;
  }

  if (sql.includes('from audit_logs')) {
    return memoryStore.audit_logs;
  }

  // Sites mutations and queries
  if (sql.startsWith('insert into sites')) {
    const seq = memoryStore.sites.length + 1;
    const code = p[2] || `SITE-${String(seq).padStart(4, '0')}`;
    const empObj = memoryStore.employees.find((e) => e.id === p[5]);
    const newSite = {
      id: p[0] || crypto.randomUUID(),
      company_id: p[1] || '00000000-0000-0000-0000-000000000001',
      site_code: code,
      name: p[3],
      location: p[4] || null,
      site_manager_id: p[5] || null,
      site_manager_name: empObj?.full_name || null,
      status: p[6] || 'Active',
      created_at: new Date().toISOString()
    };
    memoryStore.sites.unshift(newSite as any);
    return [newSite];
  }

  if (sql.startsWith('update sites')) {
    const targetId = p[4] || p[5];
    const site = memoryStore.sites.find((s) => s.id === targetId);
    if (site) {
      if (p[0]) site.name = p[0];
      if (p[1] !== undefined) site.location = p[1];
      if (p[2] !== undefined) {
        site.site_manager_id = p[2];
        const empObj = memoryStore.employees.find((e) => e.id === p[2]);
        (site as any).site_manager_name = empObj?.full_name || undefined;
      }
      if (p[3]) site.status = p[3];
      return [site];
    }
    return [];
  }

  if (sql.startsWith('delete from sites')) {
    const targetId = p[0];
    const idx = memoryStore.sites.findIndex((s) => s.id === targetId);
    if (idx >= 0) {
      const removed = memoryStore.sites.splice(idx, 1);
      return removed;
    }
    return [];
  }

  if (sql.includes('from sites')) {
    if (sql.includes('where st.id = $1') || sql.includes('where id = $1')) {
      const targetId = p[0];
      const s = memoryStore.sites.find((item) => item.id === targetId);
      return s ? [s] : [];
    }
    let list = [...memoryStore.sites];
    if (p.length > 0) {
      const searchParam = p.find(param => typeof param === 'string' && param.startsWith('%'));
      if (searchParam) {
        const queryStr = searchParam.replace(/%/g, '').toLowerCase();
        list = list.filter(s => s.name.toLowerCase().includes(queryStr) || s.site_code.toLowerCase().includes(queryStr) || (s.location && s.location.toLowerCase().includes(queryStr)));
      }
      const statusParam = p.find(param => ['Active', 'On Hold', 'Completed'].includes(param));
      if (statusParam) {
        list = list.filter(s => s.status === statusParam);
      }
    }
    return list;
  }

  if (sql.startsWith('insert into financial_documents')) {
    const siteObj = memoryStore.sites.find((s) => s.id === p[3]);
    let parsedItems = [];
    try {
      parsedItems = typeof p[6] === 'string' ? JSON.parse(p[6]) : p[6];
    } catch (e) {
      parsedItems = [];
    }
    const newDoc = {
      id: p[0] || crypto.randomUUID(),
      invoice_no: p[1],
      company_id: p[2] || '00000000-0000-0000-0000-000000000001',
      site_id: p[3],
      site_name: siteObj?.name || 'Construction Site',
      vendor_name: p[4],
      date: p[5],
      items: parsedItems,
      subtotal: Number(p[7] || 0),
      tax: Number(p[8] || 0),
      discount: Number(p[9] || 0),
      total: Number(p[10] || 0),
      status: p[11] || 'Pending',
      admin_remarks: p[12] || '',
      created_by: p[13],
      created_by_name: 'Rahul Kumar (Purchase)',
      created_at: new Date().toISOString()
    };
    memoryStore.financial_documents.unshift(newDoc as any);
    return [newDoc];
  }

  if (sql.startsWith('update financial_documents')) {
    const targetId = p[3];
    const doc = memoryStore.financial_documents.find((d: any) => d.id === targetId);
    if (doc) {
      if (p[0]) doc.status = p[0];
      if (p[1] !== undefined) doc.admin_remarks = p[1];
      if (p[2]) (doc as any).approved_by = p[2];
      return [doc];
    }
    return [];
  }

  if (sql.includes('from financial_documents')) {
    if (sql.includes('where id = $1') || sql.includes('where fd.id = $1')) {
      const targetId = p[0];
      const match = (memoryStore.financial_documents || []).find((d: any) => d.id === targetId);
      return match ? [match] : [];
    }
    return memoryStore.financial_documents || [];
  }

  if (sql.includes('from product_requests')) {
    if (sql.includes('where id = $1') || sql.includes('where prq.id = $1')) {
      const targetId = p[0];
      const match = (memoryStore.product_requests || []).filter((r: any) => r.id === targetId);
      return match;
    }
    return memoryStore.product_requests || [];
  }

  if (sql.includes('from inventory_transactions')) {
    return memoryStore.inventory_transactions || [];
  }

  if (sql.includes('from inventory')) {
    if (sql.includes('where site_id = $1 and product_id = $2')) {
      const siteId = p[0];
      const prodId = p[1];
      const match = (memoryStore.inventory || []).find((inv: any) => inv.site_id === siteId && inv.product_id === prodId);
      return match ? [match] : [];
    }
    return memoryStore.inventory || [];
  }

  if (sql.includes('from material_transfers')) {
    if (sql.includes('where id = $1')) {
      const targetId = p[0];
      const match = (memoryStore.material_transfers || []).filter((t: any) => t.id === targetId);
      return match;
    }
    return memoryStore.material_transfers || [];
  }

  if (sql.includes('from material_usage')) {
    return memoryStore.material_usage || [];
  }

  if (sql.includes('from damaged_materials')) {
    return memoryStore.damaged_materials || [];
  }

  if (sql.includes('from unwanted_materials')) {
    return memoryStore.unwanted_materials || [];
  }

  return [{ id: crypto.randomUUID(), total: 1, cnt: 1 }];
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();

  if (useInMemoryFallback || !ENV.DATABASE_URL || ENV.DATABASE_URL.includes('[YOUR_PASSWORD]')) {
    if (!useInMemoryFallback) {
      console.warn('⚠️  PostgreSQL DATABASE_URL not set or contains placeholder. Active fallback to seeded in-memory store.');
      useInMemoryFallback = true;
    }
    return executeInMemoryQuery(text, params) as T[];
  }

  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (ENV.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 80), duration, rows: res.rowCount });
    }
    return res.rows;
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.code === '28P01' || error.code === '42P01') {
      console.warn(`⚠️  PostgreSQL query failed (${error.code || 'Connection issue'}). Falling back to pre-seeded in-memory store. Run migrations in supabase/migrations to setup PostgreSQL tables.`);
      useInMemoryFallback = true;
      return executeInMemoryQuery(text, params) as T[];
    }
    console.error('Database Query Error:', error);
    throw error;
  }
}
