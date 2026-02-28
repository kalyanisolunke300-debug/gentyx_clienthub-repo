// lib/email-logger.ts
// Centralized email logging service for tracking all system-generated emails

import { getDbPool } from "@/lib/db";

export type EmailLogStatus = 'Pending' | 'Sent' | 'Delivered' | 'Failed' | 'Unknown';

export type EmailType =
    | 'welcome_client'
    | 'welcome_cpa'
    | 'welcome_service_center'
    | 'task_notification'
    | 'task_assigned'
    | 'task_updated'
    | 'message_notification'
    | 'document_notification'
    | 'stage_notification'
    | 'custom_email'
    | 'onboarding_task'
    | 'general';

export interface EmailLogEntry {
    recipientEmail: string;
    recipientName?: string;
    recipientRole?: 'CLIENT' | 'CPA' | 'SERVICE_CENTER' | null;
    relatedEntityType?: 'client' | 'cpa' | 'service_center' | null;
    relatedEntityId?: number | null;
    relatedEntityName?: string | null;
    emailType: EmailType;
    emailSubject: string;
    emailBodyPreview?: string;
    status: EmailLogStatus;
    statusMessage?: string;
    acsMessageId?: string;
    metadata?: Record<string, any>;
}

export interface EmailLogRecord extends EmailLogEntry {
    id: number;
    createdAt: string;
    sentAt?: string;
    deliveredAt?: string;
    originalEmailId?: number;
    resendCount: number;
    lastResentAt?: string;
    resentBy?: string;
}

/**
 * Log an email to the database
 */
export async function logEmail(entry: EmailLogEntry): Promise<number | null> {
    try {
        const pool = await getDbPool();
        const bodyPreview = entry.emailBodyPreview ? entry.emailBodyPreview.substring(0, 2000) : null;
        const sentAt = (entry.status === 'Sent' || entry.status === 'Delivered') ? new Date() : null;

        const result = await pool.query(`
        INSERT INTO public."email_logs" (
          recipient_email, recipient_name, recipient_role, related_entity_type,
          related_entity_id, related_entity_name, email_type, email_subject,
          email_body_preview, status, status_message, acs_message_id, metadata, sent_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        RETURNING id
      `, [
            entry.recipientEmail, entry.recipientName || null, entry.recipientRole || null,
            entry.relatedEntityType || null, entry.relatedEntityId || null,
            entry.relatedEntityName || null, entry.emailType, entry.emailSubject,
            bodyPreview, entry.status, entry.statusMessage || null,
            entry.acsMessageId || null, entry.metadata ? JSON.stringify(entry.metadata) : null, sentAt
        ]);

        const logId = result.rows[0]?.id;
        console.log(`📧 Email logged with ID: ${logId}`);
        return logId;
    } catch (error) {
        console.error("❌ Failed to log email:", error);
        return null;
    }
}

/**
 * Update an existing email log status
 */
export async function updateEmailLogStatus(
    logId: number, status: EmailLogStatus, statusMessage?: string, acsMessageId?: string
): Promise<boolean> {
    try {
        const pool = await getDbPool();
        const sentAt = (status === 'Sent' || status === 'Delivered') ? new Date() : null;
        const deliveredAt = status === 'Delivered' ? new Date() : null;

        await pool.query(`
        UPDATE public."email_logs"
        SET status = $1, status_message = COALESCE($2, status_message),
            acs_message_id = COALESCE($3, acs_message_id),
            sent_at = COALESCE($4, sent_at), delivered_at = COALESCE($5, delivered_at)
        WHERE id = $6
      `, [status, statusMessage || null, acsMessageId || null, sentAt, deliveredAt, logId]);

        console.log(`📧 Email log ${logId} updated to status: ${status}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to update email log ${logId}:`, error);
        return false;
    }
}

/**
 * Log a resend attempt
 */
export async function logResendAttempt(originalLogId: number, resentBy: string): Promise<boolean> {
    try {
        const pool = await getDbPool();
        await pool.query(`
        UPDATE public."email_logs"
        SET resend_count = resend_count + 1, last_resent_at = NOW(), resent_by = $1
        WHERE id = $2
      `, [resentBy, originalLogId]);
        return true;
    } catch (error) {
        console.error(`❌ Failed to log resend attempt for ${originalLogId}:`, error);
        return false;
    }
}

export interface EmailLogFilters {
    page?: number;
    pageSize?: number;
    recipientRole?: string;
    status?: string;
    emailType?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
}

export interface EmailLogsResponse {
    data: EmailLogRecord[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * Fetch email logs with filtering and pagination
 */
export async function fetchEmailLogs(filters: EmailLogFilters): Promise<EmailLogsResponse> {
    const pool = await getDbPool();
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.recipientRole && filters.recipientRole !== 'all') {
        conditions.push(`recipient_role = $${paramIdx++}`);
        params.push(filters.recipientRole);
    }
    if (filters.status && filters.status !== 'all') {
        conditions.push(`status = $${paramIdx++}`);
        params.push(filters.status);
    }
    if (filters.emailType && filters.emailType !== 'all') {
        conditions.push(`email_type = $${paramIdx++}`);
        params.push(filters.emailType);
    }
    if (filters.dateFrom) {
        conditions.push(`created_at >= $${paramIdx++}`);
        params.push(new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        conditions.push(`created_at <= $${paramIdx++}`);
        params.push(endDate);
    }
    if (filters.search) {
        conditions.push(`(recipient_email ILIKE $${paramIdx} OR recipient_name ILIKE $${paramIdx} OR email_subject ILIKE $${paramIdx} OR related_entity_name ILIKE $${paramIdx})`);
        params.push(`%${filters.search}%`);
        paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM public."email_logs" ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    // Get paginated data
    const dataParams = [...params, offset, pageSize];
    const dataResult = await pool.query(`
    SELECT id, recipient_email as "recipientEmail", recipient_name as "recipientName",
      recipient_role as "recipientRole", related_entity_type as "relatedEntityType",
      related_entity_id as "relatedEntityId", related_entity_name as "relatedEntityName",
      email_type as "emailType", email_subject as "emailSubject",
      email_body_preview as "emailBodyPreview", status, status_message as "statusMessage",
      acs_message_id as "acsMessageId", original_email_id as "originalEmailId",
      resend_count as "resendCount", last_resent_at as "lastResentAt",
      resent_by as "resentBy", created_at as "createdAt", sent_at as "sentAt",
      delivered_at as "deliveredAt", metadata
    FROM public."email_logs" ${whereClause}
    ORDER BY created_at DESC
    OFFSET $${paramIdx++} LIMIT $${paramIdx++}
  `, dataParams);

    const data = dataResult.rows.map((row: any) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    return { data, total, page, pageSize };
}

/**
 * Get a single email log by ID
 */
export async function getEmailLogById(id: number): Promise<EmailLogRecord | null> {
    try {
        const pool = await getDbPool();
        const result = await pool.query(`
        SELECT id, recipient_email as "recipientEmail", recipient_name as "recipientName",
          recipient_role as "recipientRole", related_entity_type as "relatedEntityType",
          related_entity_id as "relatedEntityId", related_entity_name as "relatedEntityName",
          email_type as "emailType", email_subject as "emailSubject",
          email_body_preview as "emailBodyPreview", status, status_message as "statusMessage",
          acs_message_id as "acsMessageId", original_email_id as "originalEmailId",
          resend_count as "resendCount", last_resent_at as "lastResentAt",
          resent_by as "resentBy", created_at as "createdAt", sent_at as "sentAt",
          delivered_at as "deliveredAt", metadata
        FROM public."email_logs" WHERE id = $1
      `, [id]);

        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null };
    } catch (error) {
        console.error(`❌ Failed to get email log ${id}:`, error);
        return null;
    }
}
