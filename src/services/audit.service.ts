import { query } from '../config/db.js';

export interface AuditPayload {
  actorUserId?: string;
  actorEmployeeId: string;
  action: string;
  module: string;
  entityType: string;
  entityId?: string;
  changeMetadata?: Record<string, any>;
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    const text = `
      INSERT INTO audit_logs (actor_user_id, actor_employee_id, action, module, entity_type, entity_id, change_metadata, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;
    const values = [
      payload.actorUserId || null,
      payload.actorEmployeeId,
      payload.action,
      payload.module,
      payload.entityType,
      payload.entityId || null,
      payload.changeMetadata ? JSON.stringify(payload.changeMetadata) : null
    ];
    await query(text, values);
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Never crash primary operations due to audit failure
  }
}
