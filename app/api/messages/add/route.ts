import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { sendMessageNotification } from "@/lib/email";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const { client_id, sender_role, receiver_role, body, parent_message_id, attachment_url, attachment_name } = await req.json();

    const pool = await getDbPool();

    // Handle client_id: convert "0" or invalid values to null for admin-level chats
    const parsedClientId = client_id ? parseInt(client_id) : 0;
    const validClientId = parsedClientId > 0 ? parsedClientId : null;

    console.log("📨 Adding message:", { client_id, parsedClientId, validClientId, sender_role, receiver_role });

    // Insert the message
    try {
      await pool.request()
        .input("client_id", sql.Int, validClientId)
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
      console.log("✅ Message inserted successfully");
    } catch (insertErr: any) {
      // If INSERT fails due to NULL constraint, try making client_id nullable
      console.error("❌ Insert failed:", insertErr.message);

      if (insertErr.message?.includes("Cannot insert the value NULL") ||
        insertErr.message?.includes("FOREIGN KEY constraint") ||
        insertErr.message?.includes("violates foreign key")) {

        console.log("🔧 Attempting to alter table to allow NULL client_id...");

        // Try to alter the column to allow NULL
        try {
          await pool.request().query(`
            ALTER TABLE dbo.onboarding_messages ALTER COLUMN client_id INT NULL
          `);
          console.log("✅ Table altered to allow NULL client_id");

          // Try insert again
          await pool.request()
            .input("client_id", sql.Int, validClientId)
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
          console.log("✅ Message inserted after table alteration");
        } catch (alterErr) {
          console.error("❌ Failed to alter table:", alterErr);
          throw insertErr; // Rethrow original error
        }
      } else {
        throw insertErr;
      }
    }

    // Send email notification (async, non-blocking) - only for client-specific messages
    if (validClientId) {
      console.log("📧 Attempting to send email notification...");
      console.log("📧 Client ID:", validClientId, "Sender Role:", sender_role);

      sendEmailNotification(pool, validClientId, sender_role, body)
        .then((result) => {
          console.log("📧 Email notification result:", result);
        })
        .catch((err) => {
          console.error("❌ Email notification failed:", err);
        });

      // Audit log
      logAudit({
        clientId: validClientId,
        action: AuditActions.MESSAGE_SENT,
        actorRole: sender_role === "ADMIN" ? "ADMIN" : "CLIENT",
        details: body.substring(0, 50) + (body.length > 50 ? "..." : ""),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/messages/add error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
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
    console.log("📧 sendEmailNotification called - senderRole:", senderRole);

    if (senderRole === "ADMIN") {
      // Admin sent message → notify client
      console.log("📧 Admin sent message, looking up client...");

      const clientResult = await pool.request()
        .input("client_id", sql.Int, clientId)
        .query(`
          SELECT client_name, primary_contact_email, primary_contact_name
          FROM dbo.Clients
          WHERE client_id = @client_id
        `);

      const client = clientResult.recordset[0];
      console.log("📧 Client data found:", {
        clientName: client?.client_name,
        hasEmail: !!client?.primary_contact_email,
        email: client?.primary_contact_email?.substring(0, 5) + "***" // Partial for privacy
      });

      if (client?.primary_contact_email) {
        // Helper to check if a value is a valid name (not empty, not just numbers)
        const isValidName = (name: string | null | undefined): boolean => {
          if (!name) return false;
          const trimmed = name.trim();
          if (!trimmed) return false;
          // Skip if it's just a number (like client ID)
          if (/^\d+$/.test(trimmed)) return false;
          return true;
        };

        // Ensure we have a proper name, never use client ID or numeric values
        let recipientName = "Valued Client";
        if (isValidName(client.primary_contact_name)) {
          recipientName = client.primary_contact_name.trim();
        } else if (isValidName(client.client_name)) {
          recipientName = client.client_name.trim();
        }

        console.log("📧 Sending email to client:", client.primary_contact_email, "Name:", recipientName);
        console.log("📧 Raw name values:", {
          primary_contact_name: client.primary_contact_name,
          client_name: client.client_name,
          computed_name: recipientName
        });

        const result = await sendMessageNotification({
          recipientEmail: client.primary_contact_email,
          recipientName,
          senderName: "Your Account Manager",
          messagePreview: messageBody,
          clientId,
        });
        console.log("📧 Email send result:", result);
        return result;
      } else {
        console.warn("⚠️ No primary_contact_email found for client ID:", clientId);
        return { success: false, reason: "No client email found" };
      }
    } else if (senderRole === "CLIENT") {
      // Client sent message → notify admin/service center
      console.log("📧 Client sent message, looking up service center...");

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

      console.log("📧 Service center data:", {
        clientName: data?.client_name,
        hasServiceCenterEmail: !!recipientEmail,
        email: recipientEmail?.substring(0, 5) + "***" // Partial for privacy
      });

      if (recipientEmail) {
        console.log("📧 Sending email to service center:", recipientEmail);
        const emailResult = await sendMessageNotification({
          recipientEmail,
          recipientName: data.service_center_name || "Admin",
          senderName: data.client_name || "Client",
          messagePreview: messageBody,
          clientId,
        });
        console.log("📧 Email send result:", emailResult);
        return emailResult;
      } else {
        console.warn("⚠️ No service center email found for client ID:", clientId);
        return { success: false, reason: "No service center email found" };
      }
    } else {
      console.warn("⚠️ Unknown sender role:", senderRole);
      return { success: false, reason: "Unknown sender role" };
    }
  } catch (err) {
    console.error("❌ sendEmailNotification error:", err);
    throw err;
  }
}
