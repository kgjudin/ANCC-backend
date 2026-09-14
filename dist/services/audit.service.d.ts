export interface AuditPayload {
    actorUserId?: string;
    actorEmployeeId: string;
    action: string;
    module: string;
    entityType: string;
    entityId?: string;
    changeMetadata?: Record<string, any>;
}
export declare function logAudit(payload: AuditPayload): Promise<void>;
