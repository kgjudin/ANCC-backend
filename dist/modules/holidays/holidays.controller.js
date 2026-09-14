"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHolidays = getHolidays;
exports.createHoliday = createHoliday;
exports.deleteHoliday = deleteHoliday;
const db_js_1 = require("../../config/db.js");
const validation_1 = require("@construction/validation");
const audit_service_js_1 = require("../../services/audit.service.js");
const constants_1 = require("@construction/constants");
async function getHolidays(req, res, next) {
    const authReq = req;
    try {
        const companyId = authReq.user?.company_id;
        const { year = new Date().getFullYear() } = authReq.query;
        const holidays = await (0, db_js_1.query)(`SELECT * FROM holidays WHERE company_id = $1 AND year = $2 ORDER BY date ASC`, [companyId, Number(year)]);
        return res.json({ success: true, data: holidays });
    }
    catch (error) {
        next(error);
    }
}
async function createHoliday(req, res, next) {
    const authReq = req;
    try {
        const data = validation_1.HolidaySchema.parse(authReq.body);
        const companyId = authReq.user?.company_id;
        const actorEmployeeId = authReq.employee?.id;
        const result = await (0, db_js_1.query)(`INSERT INTO holidays (company_id, name, date, year, holiday_type, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [companyId, data.name, data.date, data.year, data.holiday_type, data.description || null, actorEmployeeId]);
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'HOLIDAY_CREATED',
            module: constants_1.AUDIT_MODULES.HOLIDAY,
            entityType: 'Holiday',
            entityId: result[0].id,
            changeMetadata: data
        });
        return res.status(201).json({ success: true, message: 'Holiday created successfully', data: result[0] });
    }
    catch (error) {
        next(error);
    }
}
async function deleteHoliday(req, res, next) {
    const authReq = req;
    try {
        const { id } = authReq.params;
        const companyId = authReq.user?.company_id;
        const actorEmployeeId = authReq.employee?.id;
        await (0, db_js_1.query)(`DELETE FROM holidays WHERE id = $1 AND company_id = $2`, [id, companyId]);
        await (0, audit_service_js_1.logAudit)({
            actorUserId: authReq.user?.id,
            actorEmployeeId,
            action: 'HOLIDAY_DELETED',
            module: constants_1.AUDIT_MODULES.HOLIDAY,
            entityType: 'Holiday',
            entityId: id
        });
        return res.json({ success: true, message: 'Holiday deleted successfully' });
    }
    catch (error) {
        next(error);
    }
}
