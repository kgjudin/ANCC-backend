import fs from 'fs';
import path from 'path';
import { query } from './config/db.js';

async function runSeed() {
  console.log('Seeding initial data into database...');
  try {
    const seedPath = path.resolve(__dirname, '../../supabase/seed/seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');

    await query(sql);
    console.log('Database seeded successfully!');
    console.log('==================================================');
    console.log('Default Seed Login Accounts:');
    console.log('1. Super Admin: admin@construction.com     / password123');
    console.log('2. HR Manager:  hr@construction.com        / password123');
    console.log('3. Purchase Exec: purchase@construction.com / password123');
    console.log('4. Employee:    employee@construction.com  / password123');
    console.log('==================================================');
    process.exit(0);
  } catch (error) {
    console.error('Failed to run seed:', error);
    process.exit(1);
  }
}

runSeed();
