import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { sendMessageNotification, sendAdminMessageNotification, getAdminsWithNotificationsEnabled } from "@/lib/email";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const { client_id, sender_role, receiver_role, body, parent_message_id, attachment_url, attachment_name, service_center_id, cpa_id } = await req.json();

    const pool = await getDbPool();

    const parsedClientId = client_id ? parseInt(client_id) : 0;
    const validClientId = parsedClientId > 0 ? parsedClientId : null;
    const parsedServiceCenterId = service_center_id ? parseInt(service_center_id) : null;
    const parsedCpaId = cpa_id ? parseInt(cpa_id) : null;

    console.log("📨 Adding message:", { client_id, parsedClientId, validClientId, sender_role, receiver_role, service_center_id: parsedServiceCenterId, cpa_id: parsedCpaId });

    // Insert the message
    await pool.query(`
      INSERT INTO public."onboarding_messages" 
      (client_id, sender_role, receiver_role, body, parent_message_id, attachment_url, attachment_name, service_center_id, cpa_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [validClientId, sender_role, receiver_role, body, parent_message_id || null, attachment_url || null, attachment_name || null, parsedServiceCenterId, parsedCpaId]);

    console.log("✅ Message inserted successfully");

    // Send email notification (async, non-blocking)
    sendEmailNotificationPg(pool, {
      clientId: validClientId, senderRole: sender_role, receiverRole: receiver_role,
      serviceCenterId: parsedServiceCenterId, cpaId: parsedCpaId, messageBody: body,
    }).then(r => console.log("📧 Email notification result:", r)).catch(e => console.error("❌ Email notification failed:", e));

    // Audit log
    if (validClientId) {
      logAudit({
        clientId: validClientId, action: AuditActions.MESSAGE_SENT,
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
  clientId: number | null; senderRole: string; receiverRole: string;
  serviceCenterId: number | null; cpaId: number | null; messageBody: string;
}

const isValidName = (name: string | null | undefined): boolean => {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed || /^\d+$/.test(trimmed)) return false;
  return true;
};

async function sendEmailNotificationPg(pool: any, params: EmailNotificationParams) {
  const { clientId, senderRole, receiverRole, serviceCenterId, cpaId, messageBody } = params;

  try {
    // SCENARIO 1: Admin → Client
    if (senderRole === "ADMIN" && receiverRole === "CLIENT" && clientId) {
      const clientResult = await pool.query(`SELECT client_name, primary_contact_email, primary_contact_name FROM public."Clients" WHERE client_id = $1`, [clientId]);
      const client = clientResult.rows[0];
      if (client?.primary_contact_email) {
        let recipientName = "Valued Client";
        if (isValidName(client.primary_contact_name)) recipientName = client.primary_contact_name.trim();
        else if (isValidName(client.client_name)) recipientName = client.client_name.trim();
        return await sendMessageNotification({ recipientEmail: client.primary_contact_email, recipientName, senderName: "Your Account Manager", messagePreview: messageBody, clientId });
      }
      return { success: false, reason: "No client email found" };
    }

    // SCENARIO 2: Admin → Service Center
    if (senderRole === "ADMIN" && receiverRole === "SERVICE_CENTER" && serviceCenterId) {
      const scResult = await pool.query(`SELECT center_name, email FROM public."service_centers" WHERE service_center_id = $1`, [serviceCenterId]);
      const sc = scResult.rows[0];
      if (sc?.email) return await sendMessageNotification({ recipientEmail: sc.email, recipientName: sc.center_name || "Service Center", senderName: "Admin - Legacy ClientHub", messagePreview: messageBody, clientId: clientId || 0 });
      return { success: false, reason: "No service center email found" };
    }

    // SCENARIO 3: Admin → CPA
    if (senderRole === "ADMIN" && receiverRole === "CPA" && cpaId) {
      const cpaResult = await pool.query(`SELECT cpa_name, email FROM public."cpa_centers" WHERE cpa_id = $1`, [cpaId]);
      const cpa = cpaResult.rows[0];
      if (cpa?.email) return await sendMessageNotification({ recipientEmail: cpa.email, recipientName: cpa.cpa_name || "CPA", senderName: "Admin - Legacy ClientHub", messagePreview: messageBody, clientId: clientId || 0 });
      return { success: false, reason: "No CPA email found" };
    }

    // SCENARIO 4: Client → Admin
    if (senderRole === "CLIENT" && receiverRole === "ADMIN" && clientId) {
      const clientResult = await pool.query(`SELECT client_name, primary_contact_name FROM public."Clients" WHERE client_id = $1`, [clientId]);
      const client = clientResult.rows[0];
      const clientName = client?.client_name || "Client";
      const senderName = isValidName(client?.primary_contact_name) ? client.primary_contact_name : clientName;
      const admins = await getAdminsWithNotificationsEnabled();
      if (admins.length > 0) {
        for (const admin of admins) {
          try { await sendAdminMessageNotification({ adminEmail: admin.email, adminName: admin.name || "Admin", senderName, senderRole: "CLIENT", messagePreview: messageBody, clientName }); } catch (err) { console.error(`❌ Failed to send to admin ${admin.email}:`, err); }
        }
        return { success: true, sentTo: admins.length };
      }
      return { success: false, reason: "No admins with notifications enabled" };
    }

    // SCENARIO 4b: Client → Service Center
    if (senderRole === "CLIENT" && clientId && receiverRole !== "ADMIN") {
      const result = await pool.query(`SELECT c.client_name, sc.email AS service_center_email, sc.center_name AS service_center_name FROM public."Clients" c LEFT JOIN public."service_centers" sc ON sc.service_center_id = c.service_center_id WHERE c.client_id = $1`, [clientId]);
      const data = result.rows[0];
      if (data?.service_center_email) return await sendMessageNotification({ recipientEmail: data.service_center_email, recipientName: data.service_center_name || "Admin", senderName: data.client_name || "Client", messagePreview: messageBody, clientId });
      return { success: false, reason: "No service center email found" };
    }

    // SCENARIO 5: Service Center → Admin
    if (senderRole === "SERVICE_CENTER" && receiverRole === "ADMIN") {
      let scName = "Service Center";
      if (serviceCenterId) { const scResult = await pool.query(`SELECT center_name FROM public."service_centers" WHERE service_center_id = $1`, [serviceCenterId]); scName = scResult.rows[0]?.center_name || "Service Center"; }
      const admins = await getAdminsWithNotificationsEnabled();
      if (admins.length > 0) {
        for (const admin of admins) { try { await sendAdminMessageNotification({ adminEmail: admin.email, adminName: admin.name || "Admin", senderName: scName, senderRole: "SERVICE_CENTER", messagePreview: messageBody }); } catch (err) { console.error(`❌ Failed:`, err); } }
        return { success: true, sentTo: admins.length };
      }
      return { success: false, reason: "No admins with notifications enabled" };
    }

    // SCENARIO 6: CPA → Admin
    if (senderRole === "CPA" && receiverRole === "ADMIN") {
      let cpaName = "CPA";
      if (cpaId) { const cpaResult = await pool.query(`SELECT cpa_name FROM public."cpa_centers" WHERE cpa_id = $1`, [cpaId]); cpaName = cpaResult.rows[0]?.cpa_name || "CPA"; }
      const admins = await getAdminsWithNotificationsEnabled();
      if (admins.length > 0) {
        for (const admin of admins) { try { await sendAdminMessageNotification({ adminEmail: admin.email, adminName: admin.name || "Admin", senderName: cpaName, senderRole: "CPA", messagePreview: messageBody }); } catch (err) { console.error(`❌ Failed:`, err); } }
        return { success: true, sentTo: admins.length };
      }
      return { success: false, reason: "No admins with notifications enabled" };
    }

    // SCENARIO 7: Service Center → Client
    if (senderRole === "SERVICE_CENTER" && receiverRole === "CLIENT" && clientId) {
      const clientResult = await pool.query(`SELECT c.client_name, c.primary_contact_email, c.primary_contact_name, sc.center_name FROM public."Clients" c LEFT JOIN public."service_centers" sc ON sc.service_center_id = c.service_center_id WHERE c.client_id = $1`, [clientId]);
      const client = clientResult.rows[0];
      if (client?.primary_contact_email) {
        let recipientName = "Valued Client";
        if (isValidName(client.primary_contact_name)) recipientName = client.primary_contact_name.trim();
        else if (isValidName(client.client_name)) recipientName = client.client_name.trim();
        return await sendMessageNotification({ recipientEmail: client.primary_contact_email, recipientName, senderName: client.center_name || "Your Service Center", messagePreview: messageBody, clientId });
      }
      return { success: false, reason: "No client email found" };
    }

    // SCENARIO 8: CPA → Client
    if (senderRole === "CPA" && receiverRole === "CLIENT" && clientId) {
      const clientResult = await pool.query(`SELECT c.client_name, c.primary_contact_email, c.primary_contact_name, cp.cpa_name FROM public."Clients" c LEFT JOIN public."cpa_centers" cp ON cp.cpa_id = c.cpa_id WHERE c.client_id = $1`, [clientId]);
      const client = clientResult.rows[0];
      if (client?.primary_contact_email) {
        let recipientName = "Valued Client";
        if (isValidName(client.primary_contact_name)) recipientName = client.primary_contact_name.trim();
        else if (isValidName(client.client_name)) recipientName = client.client_name.trim();
        return await sendMessageNotification({ recipientEmail: client.primary_contact_email, recipientName, senderName: client.cpa_name || "Your CPA", messagePreview: messageBody, clientId });
      }
      return { success: false, reason: "No client email found" };
    }

    console.warn("⚠️ No email notification scenario matched:", { senderRole, receiverRole, clientId, serviceCenterId, cpaId });
    return { success: false, reason: "No matching notification scenario" };
  } catch (err) {
    console.error("❌ sendEmailNotification error:", err);
    throw err;
  }
}
