// lib/audit.ts
import { getDbPool } from "@/lib/db";
import sql from "mssql";

// Action type constants for consistency
export const AuditActions = {
    // Client
    CLIENT_CREATED: "Client created",
    CLIENT_UPDATED: "Client details updated",

    // Tasks
    TASK_CREATED: "Task created",
    TASK_UPDATED: "Task updated",
    TASK_COMPLETED: "Task marked as completed",
    TASK_DELETED: "Task deleted",
    TASK_ASSIGNED: "Task assigned",

    // Stages
    STAGE_STARTED: "Stage started",
    STAGE_COMPLETED: "Stage completed",
    STAGE_UPDATED: "Stage updated",

    // Documents
    DOCUMENT_UPLOADED: "Document uploaded",
    DOCUMENT_DELETED: "Document deleted",
    FOLDER_CREATED: "Folder created",
    FOLDER_DELETED: "Folder deleted",

    // Messages
    MESSAGE_SENT: "Message sent",

    // Role Assignments
    SERVICE_CENTER_ASSIGNED: "Service Center assigned",
    CPA_ASSIGNED: "CPA assigned",
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

export type AuditActorRole = "ADMIN" | "CLIENT" | "SYSTEM" | "CPA" | "SERVICE_CENTER";

interface LogAuditParams {
    clientId: number | string;
    action: string;
    actorRole: AuditActorRole;
    details?: string;
}

/**
 * Log an audit entry for a client action
 */
export async function logAudit({
    clientId,
    action,
    actorRole,
    details,
}: LogAuditParams): Promise<void> {
    try {
        const pool = await getDbPool();

        const fullAction = details ? `${action}: ${details}` : action;

        await pool.request()
            .input("client_id", sql.Int, Number(clientId))
            .input("action", sql.NVarChar(500), fullAction)
            .input("actor_role", sql.VarChar(50), actorRole)
            .query(`
        INSERT INTO dbo.onboarding_audit_log 
        (client_id, action, actor_role, created_at)
        VALUES (@client_id, @action, @actor_role, GETDATE())
      `);

        console.log(`[AUDIT] ${actorRole} | ${fullAction} | Client: ${clientId}`);
    } catch (error) {
        // Don't throw - audit logging should never break the main operation
        console.error("[AUDIT ERROR]", error);
    }
}
