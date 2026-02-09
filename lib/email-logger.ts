// lib/email-logger.ts
// Centralized email logging service for tracking all system-generated emails

import { getDbPool } from "@/lib/db";
import sql from "mssql";

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

        // Truncate body preview to first 2000 chars to avoid bloat
        const bodyPreview = entry.emailBodyPreview
            ? entry.emailBodyPreview.substring(0, 2000)
            : null;

        const result = await pool
            .request()
            .input("recipientEmail", sql.NVarChar(255), entry.recipientEmail)
            .input("recipientName", sql.NVarChar(255), entry.recipientName || null)
            .input("recipientRole", sql.NVarChar(50), entry.recipientRole || null)
            .input("relatedEntityType", sql.NVarChar(50), entry.relatedEntityType || null)
            .input("relatedEntityId", sql.Int, entry.relatedEntityId || null)
            .input("relatedEntityName", sql.NVarChar(255), entry.relatedEntityName || null)
            .input("emailType", sql.NVarChar(100), entry.emailType)
            .input("emailSubject", sql.NVarChar(500), entry.emailSubject)
            .input("emailBodyPreview", sql.NVarChar(sql.MAX), bodyPreview)
            .input("status", sql.NVarChar(50), entry.status)
            .input("statusMessage", sql.NVarChar(sql.MAX), entry.statusMessage || null)
            .input("acsMessageId", sql.NVarChar(255), entry.acsMessageId || null)
            .input("metadata", sql.NVarChar(sql.MAX), entry.metadata ? JSON.stringify(entry.metadata) : null)
            .input("sentAt", sql.DateTime2, entry.status === 'Sent' || entry.status === 'Delivered' ? new Date() : null)
            .query(`
        INSERT INTO dbo.email_logs (
          recipient_email,
          recipient_name,
          recipient_role,
          related_entity_type,
          related_entity_id,
          related_entity_name,
          email_type,
          email_subject,
          email_body_preview,
          status,
          status_message,
          acs_message_id,
          metadata,
          sent_at,
          created_at
        )
        OUTPUT INSERTED.id
        VALUES (
          @recipientEmail,
          @recipientName,
          @recipientRole,
          @relatedEntityType,
          @relatedEntityId,
          @relatedEntityName,
          @emailType,
          @emailSubject,
          @emailBodyPreview,
          @status,
          @statusMessage,
          @acsMessageId,
          @metadata,
          @sentAt,
          GETDATE()
        )
      `);

        const logId = result.recordset[0]?.id;
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
    logId: number,
    status: EmailLogStatus,
    statusMessage?: string,
    acsMessageId?: string
): Promise<boolean> {
    try {
        const pool = await getDbPool();

        const sentAt = (status === 'Sent' || status === 'Delivered') ? new Date() : null;
        const deliveredAt = status === 'Delivered' ? new Date() : null;

        await pool
            .request()
            .input("id", sql.Int, logId)
            .input("status", sql.NVarChar(50), status)
            .input("statusMessage", sql.NVarChar(sql.MAX), statusMessage || null)
            .input("acsMessageId", sql.NVarChar(255), acsMessageId || null)
            .input("sentAt", sql.DateTime2, sentAt)
            .input("deliveredAt", sql.DateTime2, deliveredAt)
            .query(`
        UPDATE dbo.email_logs
        SET 
          status = @status,
          status_message = COALESCE(@statusMessage, status_message),
          acs_message_id = COALESCE(@acsMessageId, acs_message_id),
          sent_at = COALESCE(@sentAt, sent_at),
          delivered_at = COALESCE(@deliveredAt, delivered_at)
        WHERE id = @id
      `);

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
export async function logResendAttempt(
    originalLogId: number,
    resentBy: string
): Promise<boolean> {
    try {
        const pool = await getDbPool();

        await pool
            .request()
            .input("id", sql.Int, originalLogId)
            .input("resentBy", sql.NVarChar(255), resentBy)
            .query(`
        UPDATE dbo.email_logs
        SET 
          resend_count = resend_count + 1,
          last_resent_at = GETDATE(),
          resent_by = @resentBy
        WHERE id = @id
      `);

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

    // Build WHERE clauses
    const conditions: string[] = [];
    const request = pool.request();

    if (filters.recipientRole && filters.recipientRole !== 'all') {
        conditions.push("recipient_role = @recipientRole");
        request.input("recipientRole", sql.NVarChar(50), filters.recipientRole);
    }

    if (filters.status && filters.status !== 'all') {
        conditions.push("status = @status");
        request.input("status", sql.NVarChar(50), filters.status);
    }

    if (filters.emailType && filters.emailType !== 'all') {
        conditions.push("email_type = @emailType");
        request.input("emailType", sql.NVarChar(100), filters.emailType);
    }

    if (filters.dateFrom) {
        conditions.push("created_at >= @dateFrom");
        request.input("dateFrom", sql.DateTime2, new Date(filters.dateFrom));
    }

    if (filters.dateTo) {
        conditions.push("created_at <= @dateTo");
        // Add 1 day to include the entire end date
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        request.input("dateTo", sql.DateTime2, endDate);
    }

    if (filters.search) {
        conditions.push(`(
      recipient_email LIKE @search 
      OR recipient_name LIKE @search 
      OR email_subject LIKE @search
      OR related_entity_name LIKE @search
    )`);
        request.input("search", sql.NVarChar(255), `%${filters.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await request.query(`
    SELECT COUNT(*) as total FROM dbo.email_logs ${whereClause}
  `);
    const total = countResult.recordset[0]?.total || 0;

    // Get paginated data - need a fresh request for the data query
    const dataRequest = pool.request();

    // Re-add inputs for data query
    if (filters.recipientRole && filters.recipientRole !== 'all') {
        dataRequest.input("recipientRole", sql.NVarChar(50), filters.recipientRole);
    }
    if (filters.status && filters.status !== 'all') {
        dataRequest.input("status", sql.NVarChar(50), filters.status);
    }
    if (filters.emailType && filters.emailType !== 'all') {
        dataRequest.input("emailType", sql.NVarChar(100), filters.emailType);
    }
    if (filters.dateFrom) {
        dataRequest.input("dateFrom", sql.DateTime2, new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        dataRequest.input("dateTo", sql.DateTime2, endDate);
    }
    if (filters.search) {
        dataRequest.input("search", sql.NVarChar(255), `%${filters.search}%`);
    }

    dataRequest.input("offset", sql.Int, offset);
    dataRequest.input("pageSize", sql.Int, pageSize);

    const dataResult = await dataRequest.query(`
    SELECT 
      id,
      recipient_email as recipientEmail,
      recipient_name as recipientName,
      recipient_role as recipientRole,
      related_entity_type as relatedEntityType,
      related_entity_id as relatedEntityId,
      related_entity_name as relatedEntityName,
      email_type as emailType,
      email_subject as emailSubject,
      email_body_preview as emailBodyPreview,
      status,
      status_message as statusMessage,
      acs_message_id as acsMessageId,
      original_email_id as originalEmailId,
      resend_count as resendCount,
      last_resent_at as lastResentAt,
      resent_by as resentBy,
      created_at as createdAt,
      sent_at as sentAt,
      delivered_at as deliveredAt,
      metadata
    FROM dbo.email_logs
    ${whereClause}
    ORDER BY created_at DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

    // Parse metadata JSON
    const data = dataResult.recordset.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    return {
        data,
        total,
        page,
        pageSize
    };
}

/**
 * Get a single email log by ID
 */
export async function getEmailLogById(id: number): Promise<EmailLogRecord | null> {
    try {
        const pool = await getDbPool();

        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`
        SELECT 
          id,
          recipient_email as recipientEmail,
          recipient_name as recipientName,
          recipient_role as recipientRole,
          related_entity_type as relatedEntityType,
          related_entity_id as relatedEntityId,
          related_entity_name as relatedEntityName,
          email_type as emailType,
          email_subject as emailSubject,
          email_body_preview as emailBodyPreview,
          status,
          status_message as statusMessage,
          acs_message_id as acsMessageId,
          original_email_id as originalEmailId,
          resend_count as resendCount,
          last_resent_at as lastResentAt,
          resent_by as resentBy,
          created_at as createdAt,
          sent_at as sentAt,
          delivered_at as deliveredAt,
          metadata
        FROM dbo.email_logs
        WHERE id = @id
      `);

        if (result.recordset.length === 0) return null;

        const row = result.recordset[0];
        return {
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        };
    } catch (error) {
        console.error(`❌ Failed to get email log ${id}:`, error);
        return null;
    }
}
