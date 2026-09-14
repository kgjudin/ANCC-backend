"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductCategories = getProductCategories;
exports.getProducts = getProducts;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
const db_js_1 = require("../../config/db.js");
const validation_1 = require("@construction/validation");
const audit_service_js_1 = require("../../services/audit.service.js");
const constants_1 = require("@construction/constants");
async function getProductCategories(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id;
        const categories = await (0, db_js_1.query)(`SELECT * FROM product_categories WHERE company_id = $1 ORDER BY name ASC`, [companyId]);
        return res.json({ success: true, data: categories });
    }
    catch (error) {
        next(error);
    }
}
async function getProducts(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id;
        const { search, category_id, page = 1, limit = 50 } = authReq.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = `WHERE p.company_id = $1`;
        const params = [companyId];
        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (p.name ILIKE $${params.length} OR p.product_code ILIKE $${params.length})`;
        }
        if (category_id) {
            params.push(category_id);
            whereClause += ` AND p.category_id = $${params.length}`;
        }
        const countRows = await (0, db_js_1.query)(`SELECT COUNT(*) as total FROM products p ${whereClause}`, params);
        const total = Number(countRows[0].total);
        params.push(Number(limit), offset);
        const products = await (0, db_js_1.query)(`SELECT p.*, pc.name as category_name
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       ${whereClause}
       ORDER BY p.name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return res.json({
            success: true,
            data: {
                items: products,
                total,
                page: Number(page),
                limit: Number(limit),
                total_pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
}
async function createProduct(req, res, next) {
    const authReq = req;
    try {
        const data = validation_1.ProductSchema.parse(authReq.body);
        const companyId = authReq.user?.company_id;
        const actorEmployeeId = authReq.employee?.id;
        const countRes = await (0, db_js_1.query)(`SELECT COUNT(*) as cnt FROM products WHERE company_id = $1`, [companyId]);
        const seq = Number(countRes[0].cnt) + 1;
        const productCode = `PRD-${String(seq).padStart(4, '0')}`;
        const result = await (0, db_js_1.query)(`INSERT INTO products (product_code, company_id, name, category_id, unit, standard_rate, description, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING *`, [
            productCode,
            companyId,
            data.name,
            data.category_id || null,
            data.unit,
            data.standard_rate,
            data.description || null,
            actorEmployeeId
        ]);
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'PRODUCT_CREATED',
            module: constants_1.AUDIT_MODULES.PRODUCT,
            entityType: 'Product',
            entityId: result[0].id,
            changeMetadata: { product_code: productCode, name: data.name }
        });
        return res.status(201).json({ success: true, message: 'Product created successfully', data: result[0] });
    }
    catch (error) {
        next(error);
    }
}
async function updateProduct(req, res, next) {
    const authReq = req;
    try {
        const { id } = authReq.params;
        const data = validation_1.ProductSchema.parse(authReq.body);
        const companyId = authReq.user?.company_id;
        const actorEmployeeId = authReq.employee?.id;
        const result = await (0, db_js_1.query)(`UPDATE products SET
        name = $1,
        category_id = $2,
        unit = $3,
        standard_rate = $4,
        description = $5,
        updated_by = $6,
        updated_at = NOW()
       WHERE id = $7 AND company_id = $8
       RETURNING *`, [
            data.name,
            data.category_id || null,
            data.unit,
            data.standard_rate,
            data.description || null,
            actorEmployeeId,
            id,
            companyId
        ]);
        if (result.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
        }
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'PRODUCT_UPDATED',
            module: constants_1.AUDIT_MODULES.PRODUCT,
            entityType: 'Product',
            entityId: id,
            changeMetadata: data
        });
        return res.json({ success: true, message: 'Product updated successfully', data: result[0] });
    }
    catch (error) {
        next(error);
    }
}
