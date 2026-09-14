"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_js_1 = require("./config/db.js");
async function runSeed() {
    console.log('Seeding initial data into database...');
    try {
        const seedPath = path_1.default.resolve(__dirname, '../../supabase/seed/seed.sql');
        const sql = fs_1.default.readFileSync(seedPath, 'utf8');
        await (0, db_js_1.query)(sql);
        console.log('Database seeded successfully!');
        console.log('==================================================');
        console.log('Default Seed Login Accounts:');
        console.log('1. Super Admin: admin@construction.com     / password123');
        console.log('2. HR Manager:  hr@construction.com        / password123');
        console.log('3. Purchase Exec: purchase@construction.com / password123');
        console.log('4. Employee:    employee@construction.com  / password123');
        console.log('==================================================');
        process.exit(0);
    }
    catch (error) {
        console.error('Failed to run seed:', error);
        process.exit(1);
    }
}
runSeed();
