// lib/audit.ts
import { getDbPool } from "@/lib/db";

export const AuditActions = {
    CLIENT_CREATED: "Client created",
    CLIENT_UPDATED: "Client details updated",
    TASK_CREATED: "Task created",
    TASK_UPDATED: "Task updated",
    TASK_COMPLETED: "Task marked as completed",
    TASK_DELETED: "Task deleted",
    TASK_ASSIGNED: "Task assigned",
    STAGE_STARTED: "Stage started",
    STAGE_COMPLETED: "Stage completed",
    STAGE_UPDATED: "Stage updated",
    DOCUMENT_UPLOADED: "Document uploaded",
    DOCUMENT_DELETED: "Document deleted",
    FOLDER_CREATED: "Folder created",
    FOLDER_DELETED: "Folder deleted",
    MESSAGE_SENT: "Message sent",
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

export async function logAudit({ clientId, action, actorRole, details }: LogAuditParams): Promise<void> {
    try {
        const pool = await getDbPool();
        const fullAction = details ? `${action}: ${details}` : action;

        await pool.query(
            `INSERT INTO public."onboarding_audit_log" (client_id, action, actor_role, created_at) VALUES ($1, $2, $3, NOW())`,
            [Number(clientId), fullAction, actorRole]
        );

        console.log(`[AUDIT] ${actorRole} | ${fullAction} | Client: ${clientId}`);
    } catch (error) {
        console.error("[AUDIT ERROR]", error);
    }
}
