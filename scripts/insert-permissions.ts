import { query } from '../src/config/db.js';

async function run() {
  try {
    const permissions = [
      { key: 'role.view', module: 'Roles & Permissions', description: 'View roles and permissions' },
      { key: 'role.create', module: 'Roles & Permissions', description: 'Create new roles' },
      { key: 'role.edit', module: 'Roles & Permissions', description: 'Edit existing roles' },
      { key: 'role.delete', module: 'Roles & Permissions', description: 'Delete roles' }
    ];

    for (const p of permissions) {
      await query(
        `INSERT INTO permissions (key, module, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
        [p.key, p.module, p.description]
      );
      console.log(`Inserted permission: ${p.key}`);
    }

    for (const p of permissions) {
      await query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions WHERE key = $1
         ON CONFLICT DO NOTHING`,
        [p.key]
      );
    }
    console.log('Mapped to Super Admin successfully');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
