import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { sendMessageNotification } from "@/lib/email";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const { client_id, sender_role, receiver_role, body, parent_message_id, attachment_url, attachment_name } = await req.json();

    const pool = await getDbPool();

    // Insert the message
    await pool.request()
      .input("client_id", sql.Int, client_id)
      .input("sender_role", sql.VarChar(50), sender_role)
      .input("receiver_role", sql.VarChar(50), receiver_role)
      .input("body", sql.NVarChar(sql.MAX), body)
      .input("parent_message_id", sql.Int, parent_message_id || null)
      .input("attachment_url", sql.NVarChar(sql.MAX), attachment_url || null)
      .input("attachment_name", sql.NVarChar(255), attachment_name || null)
      .query(`
        INSERT INTO dbo.onboarding_messages 
        (client_id, sender_role, receiver_role, body, parent_message_id, attachment_url, attachment_name)
        VALUES (@client_id, @sender_role, @receiver_role, @body, @parent_message_id, @attachment_url, @attachment_name)
      `);

    // Send email notification (async, non-blocking)
    sendEmailNotification(pool, client_id, sender_role, body).catch((err) => {
      console.error("Email notification failed:", err);
    });

    // Audit log
    logAudit({
      clientId: client_id,
      action: AuditActions.MESSAGE_SENT,
      actorRole: sender_role === "ADMIN" ? "ADMIN" : "CLIENT",
      details: body.substring(0, 50) + (body.length > 50 ? "..." : ""),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/messages/add error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

/**
 * Send email notification to the appropriate recipient
 */
async function sendEmailNotification(
  pool: sql.ConnectionPool,
  clientId: number,
  senderRole: string,
  messageBody: string
) {
  try {
    if (senderRole === "ADMIN") {
      // Admin sent message → notify client
      const clientResult = await pool.request()
        .input("client_id", sql.Int, clientId)
        .query(`
          SELECT client_name, primary_contact_email, primary_contact_name
          FROM dbo.Clients
          WHERE client_id = @client_id
        `);

      const client = clientResult.recordset[0];
      if (client?.primary_contact_email) {
        await sendMessageNotification({
          recipientEmail: client.primary_contact_email,
          recipientName: client.primary_contact_name || client.client_name,
          senderName: "Your Account Manager",
          messagePreview: messageBody,
          clientId,
        });
        console.log(`Email sent to client: ${client.primary_contact_email}`);
      }
    } else if (senderRole === "CLIENT") {
      // Client sent message → notify admin/service center
      const result = await pool.request()
        .input("client_id", sql.Int, clientId)
        .query(`
          SELECT 
            c.client_name,
            sc.email AS service_center_email,
            sc.center_name AS service_center_name
          FROM dbo.Clients c
          LEFT JOIN dbo.service_centers sc ON sc.service_center_id = c.service_center_id
          WHERE c.client_id = @client_id
        `);

      const data = result.recordset[0];
      const recipientEmail = data?.service_center_email;

      if (recipientEmail) {
        await sendMessageNotification({
          recipientEmail,
          recipientName: data.service_center_name || "Admin",
          senderName: data.client_name || "Client",
          messagePreview: messageBody,
          clientId,
        });
        console.log(`Email sent to service center: ${recipientEmail}`);
      }
    }
  } catch (err) {
    console.error("sendEmailNotification error:", err);
    throw err;
  }
}
