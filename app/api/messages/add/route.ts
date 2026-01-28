import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { sendMessageNotification, sendAdminMessageNotification } from "@/lib/email";
import { logAudit, AuditActions } from "@/lib/audit";


export async function POST(req: Request) {
  try {
    const { client_id, sender_role, receiver_role, body, parent_message_id, attachment_url, attachment_name, service_center_id, cpa_id } = await req.json();

    const pool = await getDbPool();

    // Handle client_id: convert "0" or invalid values to null for admin-level chats
    const parsedClientId = client_id ? parseInt(client_id) : 0;
    const validClientId = parsedClientId > 0 ? parsedClientId : null;

    // Handle service_center_id and cpa_id
    const parsedServiceCenterId = service_center_id ? parseInt(service_center_id) : null;
    const parsedCpaId = cpa_id ? parseInt(cpa_id) : null;

    console.log("📨 Adding message:", { client_id, parsedClientId, validClientId, sender_role, receiver_role, service_center_id: parsedServiceCenterId, cpa_id: parsedCpaId });

    // First, ensure the columns exist
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.onboarding_messages') AND name = 'service_center_id')
        BEGIN
          ALTER TABLE dbo.onboarding_messages ADD service_center_id INT NULL
        END
      `);
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.onboarding_messages') AND name = 'cpa_id')
        BEGIN
          ALTER TABLE dbo.onboarding_messages ADD cpa_id INT NULL
        END
      `);
    } catch (alterErr) {
      console.log("⚠️ Columns may already exist:", alterErr);
    }

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
        .input("service_center_id", sql.Int, parsedServiceCenterId)
        .input("cpa_id", sql.Int, parsedCpaId)
        .query(`
          INSERT INTO dbo.onboarding_messages 
          (client_id, sender_role, receiver_role, body, parent_message_id, attachment_url, attachment_name, service_center_id, cpa_id)
          VALUES (@client_id, @sender_role, @receiver_role, @body, @parent_message_id, @attachment_url, @attachment_name, @service_center_id, @cpa_id)
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
            .input("service_center_id", sql.Int, parsedServiceCenterId)
            .input("cpa_id", sql.Int, parsedCpaId)
            .query(`
              INSERT INTO dbo.onboarding_messages 
              (client_id, sender_role, receiver_role, body, parent_message_id, attachment_url, attachment_name, service_center_id, cpa_id)
              VALUES (@client_id, @sender_role, @receiver_role, @body, @parent_message_id, @attachment_url, @attachment_name, @service_center_id, @cpa_id)
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

    // Send email notification (async, non-blocking)
    console.log("📧 Attempting to send email notification...");
    console.log("📧 Sender Role:", sender_role, "Receiver Role:", receiver_role);
    console.log("📧 Client ID:", validClientId, "Service Center ID:", parsedServiceCenterId, "CPA ID:", parsedCpaId);

    sendEmailNotification(pool, {
      clientId: validClientId,
      senderRole: sender_role,
      receiverRole: receiver_role,
      serviceCenterId: parsedServiceCenterId,
      cpaId: parsedCpaId,
      messageBody: body,
    })
      .then((result) => {
        console.log("📧 Email notification result:", result);
      })
      .catch((err) => {
        console.error("❌ Email notification failed:", err);
      });

    // Audit log (only for client-related messages)
    if (validClientId) {
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

interface EmailNotificationParams {
  clientId: number | null;
  senderRole: string;
  receiverRole: string;
  serviceCenterId: number | null;
  cpaId: number | null;
  messageBody: string;
}

/**
 * Send email notification to the appropriate recipient based on sender/receiver roles
 */
async function sendEmailNotification(
  pool: sql.ConnectionPool,
  params: EmailNotificationParams
) {
  const { clientId, senderRole, receiverRole, serviceCenterId, cpaId, messageBody } = params;

  try {
    console.log("📧 sendEmailNotification called:", { senderRole, receiverRole, clientId, serviceCenterId, cpaId });

    // Helper to check if a value is a valid name (not empty, not just numbers)
    const isValidName = (name: string | null | undefined): boolean => {
      if (!name) return false;
      const trimmed = name.trim();
      if (!trimmed) return false;
      // Skip if it's just a number (like client ID)
      if (/^\d+$/.test(trimmed)) return false;
      return true;
    };

    // ============================================
    // SCENARIO 1: Admin messaging a Client
    // ============================================
    if (senderRole === "ADMIN" && receiverRole === "CLIENT" && clientId) {
      console.log("📧 Admin → Client: Looking up client...");

      const clientResult = await pool.request()
        .input("client_id", sql.Int, clientId)
        .query(`
          SELECT client_name, primary_contact_email, primary_contact_name
          FROM dbo.Clients
          WHERE client_id = @client_id
        `);

      const client = clientResult.recordset[0];

      if (client?.primary_contact_email) {
        let recipientName = "Valued Client";
        if (isValidName(client.primary_contact_name)) {
          recipientName = client.primary_contact_name.trim();
        } else if (isValidName(client.client_name)) {
          recipientName = client.client_name.trim();
        }

        console.log("📧 Sending email to client:", client.primary_contact_email);
        return await sendMessageNotification({
          recipientEmail: client.primary_contact_email,
          recipientName,
          senderName: "Your Account Manager",
          messagePreview: messageBody,
          clientId,
        });
      } else {
        console.warn("⚠️ No email found for client ID:", clientId);
        return { success: false, reason: "No client email found" };
      }
    }

    // ============================================
    // SCENARIO 2: Admin messaging a Service Center
    // ============================================
    if (senderRole === "ADMIN" && receiverRole === "SERVICE_CENTER" && serviceCenterId) {
      console.log("📧 Admin → Service Center: Looking up service center ID:", serviceCenterId);

      const scResult = await pool.request()
        .input("service_center_id", sql.Int, serviceCenterId)
        .query(`
          SELECT center_name, email
          FROM dbo.service_centers
          WHERE service_center_id = @service_center_id
        `);

      const sc = scResult.recordset[0];

      if (sc?.email) {
        console.log("📧 Sending email to service center:", sc.email);
        return await sendMessageNotification({
          recipientEmail: sc.email,
          recipientName: sc.center_name || "Service Center",
          senderName: "Admin - Legacy ClientHub",
          messagePreview: messageBody,
          clientId: clientId || 0,
        });
      } else {
        console.warn("⚠️ No email found for service center ID:", serviceCenterId);
        return { success: false, reason: "No service center email found" };
      }
    }

    // ============================================
    // SCENARIO 3: Admin messaging a CPA
    // ============================================
    if (senderRole === "ADMIN" && receiverRole === "CPA" && cpaId) {
      console.log("📧 Admin → CPA: Looking up CPA ID:", cpaId);

      const cpaResult = await pool.request()
        .input("cpa_id", sql.Int, cpaId)
        .query(`
          SELECT cpa_name, email
          FROM dbo.cpa_centers
          WHERE cpa_id = @cpa_id
        `);

      const cpa = cpaResult.recordset[0];

      if (cpa?.email) {
        console.log("📧 Sending email to CPA:", cpa.email);
        return await sendMessageNotification({
          recipientEmail: cpa.email,
          recipientName: cpa.cpa_name || "CPA",
          senderName: "Admin - Legacy ClientHub",
          messagePreview: messageBody,
          clientId: clientId || 0,
        });
      } else {
        console.warn("⚠️ No email found for CPA ID:", cpaId);
        return { success: false, reason: "No CPA email found" };
      }
    }

    // ============================================
    // SCENARIO 4: Client messaging Admin
    // ============================================
    if (senderRole === "CLIENT" && receiverRole === "ADMIN" && clientId) {
      console.log("📧 Client → Admin: Looking up client and admin...");

      // Get client info
      const clientResult = await pool.request()
        .input("client_id", sql.Int, clientId)
        .query(`
          SELECT client_name, primary_contact_name
          FROM dbo.Clients
          WHERE client_id = @client_id
        `);
      const client = clientResult.recordset[0];
      const clientName = client?.client_name || "Client";
      const senderName = isValidName(client?.primary_contact_name)
        ? client.primary_contact_name
        : clientName;

      // Get admin email
      const adminResult = await pool.request().query(`SELECT TOP 1 email, full_name FROM AdminSettings WHERE email IS NOT NULL`);
      const admin = adminResult.recordset[0];

      if (admin?.email) {
        console.log("📧 Sending email to admin:", admin.email);
        return await sendAdminMessageNotification({
          adminEmail: admin.email,
          adminName: admin.full_name || "Admin",
          senderName,
          senderRole: "CLIENT",
          messagePreview: messageBody,
          clientName,
        });
      } else {
        console.warn("⚠️ No admin email configured");
        return { success: false, reason: "No admin email configured" };
      }
    }

    // ============================================
    // SCENARIO 4b: Client messaging Service Center (existing flow)
    // ============================================
    if (senderRole === "CLIENT" && clientId && receiverRole !== "ADMIN") {
      console.log("📧 Client → SC: Looking up service center for client...");

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
        console.log("📧 Sending email to service center:", recipientEmail);
        return await sendMessageNotification({
          recipientEmail,
          recipientName: data.service_center_name || "Admin",
          senderName: data.client_name || "Client",
          messagePreview: messageBody,
          clientId,
        });
      } else {
        console.warn("⚠️ No service center email found for client ID:", clientId);
        return { success: false, reason: "No service center email found" };
      }
    }

    // ============================================
    // SCENARIO 5: Service Center messaging Admin
    // ============================================
    if (senderRole === "SERVICE_CENTER" && receiverRole === "ADMIN") {
      console.log("📧 Service Center → Admin: Looking up service center and admin...");

      // Get service center info
      let scName = "Service Center";
      if (serviceCenterId) {
        const scResult = await pool.request()
          .input("service_center_id", sql.Int, serviceCenterId)
          .query(`SELECT center_name FROM dbo.service_centers WHERE service_center_id = @service_center_id`);
        scName = scResult.recordset[0]?.center_name || "Service Center";
      }

      // Get admin email
      const adminResult = await pool.request().query(`SELECT TOP 1 email, full_name FROM AdminSettings WHERE email IS NOT NULL`);
      const admin = adminResult.recordset[0];

      if (admin?.email) {
        console.log("📧 Sending email to admin:", admin.email);
        return await sendAdminMessageNotification({
          adminEmail: admin.email,
          adminName: admin.full_name || "Admin",
          senderName: scName,
          senderRole: "SERVICE_CENTER",
          messagePreview: messageBody,
        });
      } else {
        console.warn("⚠️ No admin email configured");
        return { success: false, reason: "No admin email configured" };
      }
    }

    // ============================================
    // SCENARIO 6: CPA messaging Admin
    // ============================================
    if (senderRole === "CPA" && receiverRole === "ADMIN") {
      console.log("📧 CPA → Admin: Looking up CPA and admin...");

      // Get CPA info
      let cpaName = "CPA";
      if (cpaId) {
        const cpaResult = await pool.request()
          .input("cpa_id", sql.Int, cpaId)
          .query(`SELECT cpa_name FROM dbo.cpa_centers WHERE cpa_id = @cpa_id`);
        cpaName = cpaResult.recordset[0]?.cpa_name || "CPA";
      }

      // Get admin email
      const adminResult = await pool.request().query(`SELECT TOP 1 email, full_name FROM AdminSettings WHERE email IS NOT NULL`);
      const admin = adminResult.recordset[0];

      if (admin?.email) {
        console.log("📧 Sending email to admin:", admin.email);
        return await sendAdminMessageNotification({
          adminEmail: admin.email,
          adminName: admin.full_name || "Admin",
          senderName: cpaName,
          senderRole: "CPA",
          messagePreview: messageBody,
        });
      } else {
        console.warn("⚠️ No admin email configured");
        return { success: false, reason: "No admin email configured" };
      }
    }


    // ============================================
    // SCENARIO 7: Service Center messaging Client
    // ============================================
    if (senderRole === "SERVICE_CENTER" && receiverRole === "CLIENT" && clientId) {
      console.log("📧 Service Center → Client: Looking up client...");

      const clientResult = await pool.request()
        .input("client_id", sql.Int, clientId)
        .query(`
          SELECT c.client_name, c.primary_contact_email, c.primary_contact_name,
                 sc.center_name
          FROM dbo.Clients c
          LEFT JOIN dbo.service_centers sc ON sc.service_center_id = c.service_center_id
          WHERE c.client_id = @client_id
        `);

      const client = clientResult.recordset[0];

      if (client?.primary_contact_email) {
        let recipientName = "Valued Client";
        if (isValidName(client.primary_contact_name)) {
          recipientName = client.primary_contact_name.trim();
        } else if (isValidName(client.client_name)) {
          recipientName = client.client_name.trim();
        }

        console.log("📧 Sending email to client:", client.primary_contact_email);
        return await sendMessageNotification({
          recipientEmail: client.primary_contact_email,
          recipientName,
          senderName: client.center_name || "Your Service Center",
          messagePreview: messageBody,
          clientId,
        });
      } else {
        console.warn("⚠️ No email found for client ID:", clientId);
        return { success: false, reason: "No client email found" };
      }
    }

    // ============================================
    // SCENARIO 8: CPA messaging Client
    // ============================================
    if (senderRole === "CPA" && receiverRole === "CLIENT" && clientId) {
      console.log("📧 CPA → Client: Looking up client...");

      const clientResult = await pool.request()
        .input("client_id", sql.Int, clientId)
        .query(`
          SELECT c.client_name, c.primary_contact_email, c.primary_contact_name,
                 cp.cpa_name
          FROM dbo.Clients c
          LEFT JOIN dbo.cpa_centers cp ON cp.cpa_id = c.cpa_id
          WHERE c.client_id = @client_id
        `);

      const client = clientResult.recordset[0];

      if (client?.primary_contact_email) {
        let recipientName = "Valued Client";
        if (isValidName(client.primary_contact_name)) {
          recipientName = client.primary_contact_name.trim();
        } else if (isValidName(client.client_name)) {
          recipientName = client.client_name.trim();
        }

        console.log("📧 Sending email to client:", client.primary_contact_email);
        return await sendMessageNotification({
          recipientEmail: client.primary_contact_email,
          recipientName,
          senderName: client.cpa_name || "Your CPA",
          messagePreview: messageBody,
          clientId,
        });
      } else {
        console.warn("⚠️ No email found for client ID:", clientId);
        return { success: false, reason: "No client email found" };
      }
    }

    // No matching scenario
    console.warn("⚠️ No email notification scenario matched:", { senderRole, receiverRole, clientId, serviceCenterId, cpaId });
    return { success: false, reason: "No matching notification scenario" };

  } catch (err) {
    console.error("❌ sendEmailNotification error:", err);
    throw err;
  }
}

