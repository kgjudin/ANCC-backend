"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
function errorHandler(err, req, res, next) {
    console.error('API Error:', err);
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input data',
                details: err.errors
            }
        });
    }
    // Helpful DB Connection Error Diagnostic
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'DATABASE_CONNECTION_REFUSED',
                message: 'Database Connection Error: Unable to connect to PostgreSQL database. Please ensure your PostgreSQL database or Supabase instance is running and check the DATABASE_URL in backend/.env.'
            }
        });
    }
    // Helpful DB Table Missing (42P01) Diagnostic
    if (err.code === '42P01') {
        return res.status(500).json({
            success: false,
            error: {
                code: 'TABLE_DOES_NOT_EXIST',
                message: `Database Schema Error: Table or relation missing (${err.message}). Please execute the SQL migrations in supabase/migrations/00001_initial_schema.sql on your PostgreSQL database.`
            }
        });
    }
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected internal server error occurred';
    return res.status(statusCode).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_SERVER_ERROR',
            message
        }
    });
}
