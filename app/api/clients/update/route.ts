// app/api/clients/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { logAudit, AuditActions } from "@/lib/audit";
import { sendUpdateNotification } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      clientId,
      client_name,
      code,
      primary_contact_first_name,
      primary_contact_last_name,
      primary_contact_name,
      primary_contact_email,
      primary_contact_phone,
      service_center_id,
      cpa_id,
    } = body;

    // Combine first and last name if not provided separately
    const fullContactName = primary_contact_name ||
      `${primary_contact_first_name || ''} ${primary_contact_last_name || ''}`.trim();

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client ID missing" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ✅ CHECK FOR DUPLICATE CLIENT NAME (CASE-INSENSITIVE, EXCLUDING CURRENT)
    if (client_name) {
      const existingClient = await pool
        .request()
        .input("clientName", sql.NVarChar(255), client_name.trim())
        .input("clientId", sql.Int, Number(clientId))
        .query(`
          SELECT client_id, client_name 
          FROM dbo.clients 
          WHERE LOWER(client_name) = LOWER(@clientName)
          AND client_id != @clientId
        `);

      if (existingClient.recordset.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `A client named "${existingClient.recordset[0].client_name}" already exists`
          },
          { status: 409 }
        );
      }
    }

    // ✅ CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (EXCLUDING CURRENT CLIENT)
    if (primary_contact_email && primary_contact_email.trim()) {
      const existingEmail = await pool
        .request()
        .input("email", sql.NVarChar(255), primary_contact_email.trim().toLowerCase())
        .input("clientId", sql.Int, Number(clientId))
        .query(`
          SELECT 'client' as entity_type, client_name as name FROM dbo.clients 
          WHERE LOWER(primary_contact_email) = @email AND client_id != @clientId
          UNION ALL
          SELECT 'CPA' as entity_type, cpa_name as name FROM dbo.cpa_centers 
          WHERE LOWER(email) = @email
          UNION ALL
          SELECT 'service center' as entity_type, center_name as name FROM dbo.service_centers 
          WHERE LOWER(email) = @email
        `);

      if (existingEmail.recordset.length > 0) {
        const existing = existingEmail.recordset[0];
        return NextResponse.json(
          {
            success: false,
            error: `This email is already used by ${existing.entity_type}: "${existing.name}"`
          },
          { status: 409 }
        );
      }
    }

    // 📧 GET OLD EMAIL BEFORE UPDATE (for syncing Users table)
    const oldEmailResult = await pool.request()
      .input("clientId", sql.Int, Number(clientId))
      .query(`SELECT primary_contact_email FROM dbo.clients WHERE client_id = @clientId`);
    const oldEmail = oldEmailResult.recordset[0]?.primary_contact_email;

    await pool
      .request()
      .input("client_id", sql.Int, Number(clientId))
      .input("client_name", sql.NVarChar, client_name)
      .input("code", sql.NVarChar, code)
      .input("primary_contact_first_name", sql.NVarChar(100), primary_contact_first_name || null)
      .input("primary_contact_last_name", sql.NVarChar(100), primary_contact_last_name || null)
      .input("primary_contact_name", sql.NVarChar, fullContactName)
      .input("primary_contact_email", sql.NVarChar, primary_contact_email)
      .input("primary_contact_phone", sql.NVarChar, primary_contact_phone)
      .input("service_center_id", sql.Int, service_center_id || null)
      .input("cpa_id", sql.Int, cpa_id || null)
      .query(`
        UPDATE dbo.Clients
        SET
          client_name = @client_name,
          code = @code,
          primary_contact_first_name = @primary_contact_first_name,
          primary_contact_last_name = @primary_contact_last_name,
          primary_contact_name = @primary_contact_name,
          primary_contact_email = @primary_contact_email,
          primary_contact_phone = @primary_contact_phone,
          service_center_id = @service_center_id,
          cpa_id = @cpa_id,
          updated_at = GETDATE()
        WHERE client_id = @client_id
      `);

    // 📧 SYNC EMAIL TO USERS TABLE (for login credentials)
    if (primary_contact_email && primary_contact_email.trim() && oldEmail &&
      primary_contact_email.toLowerCase() !== oldEmail.toLowerCase()) {
      await pool.request()
        .input("oldEmail", sql.NVarChar(255), oldEmail)
        .input("newEmail", sql.NVarChar(255), primary_contact_email)
        .query(`
          UPDATE dbo.Users 
          SET email = @newEmail 
          WHERE email = @oldEmail AND role = 'CLIENT'
        `);
      console.log(`✅ Client login email updated from ${oldEmail} to ${primary_contact_email}`);
    }

    // Audit logs
    logAudit({
      clientId,
      action: AuditActions.CLIENT_UPDATED,
      actorRole: "ADMIN",
      details: client_name,
    });

    // Log service center assignment if changed
    if (service_center_id) {
      logAudit({
        clientId,
        action: AuditActions.SERVICE_CENTER_ASSIGNED,
        actorRole: "ADMIN",
      });
    }

    // Log CPA assignment if changed
    if (cpa_id) {
      logAudit({
        clientId,
        action: AuditActions.CPA_ASSIGNED,
        actorRole: "ADMIN",
      });
    }

    // 📧 Send profile update notification email to client
    if (primary_contact_email) {
      try {
        await sendUpdateNotification({
          recipientEmail: primary_contact_email,
          recipientName: primary_contact_name || client_name,
          updateType: 'profile_updated',
          details: {
            title: 'Your Profile Has Been Updated',
            description: `Your client profile "${client_name}" has been updated by the administrator. If you did not expect this change, please contact support.`,
            actionUrl: 'https://legacy.hubonesystems.net/login',
            actionLabel: 'View Your Profile',
          },
        });
        console.log(`✅ Profile update notification sent to client: ${primary_contact_email}`);
      } catch (emailError) {
        console.error(`⚠️ Failed to send profile update notification to client: ${primary_contact_email}`, emailError);
      }
    }

    // 5️⃣ Update Associated Users (if provided)
    const associatedUsers = body.associatedUsers;
    if (Array.isArray(associatedUsers)) {
      // Delete existing associated users for this client
      await pool
        .request()
        .input("clientId", sql.Int, Number(clientId))
        .query(`DELETE FROM dbo.client_users WHERE client_id = @clientId`);

      // Insert new associated users
      for (const user of associatedUsers) {
        if (!user.name || !user.email) continue;

        await pool
          .request()
          .input("clientId", sql.Int, Number(clientId))
          .input("userName", sql.NVarChar(255), user.name)
          .input("userEmail", sql.NVarChar(255), user.email)
          .input("userRole", sql.NVarChar(50), user.role || "Client User")
          .input("phone", sql.NVarChar(50), user.phone || null)
          .query(`
            INSERT INTO dbo.client_users (
              client_id,
              user_name,
              email,
              role,
              phone,
              created_at
            )
            VALUES (
              @clientId,
              @userName,
              @userEmail,
              @userRole,
              @phone,
              GETDATE()
            )
          `);
      }
      console.log(`✅ Updated associated users for client ID: ${clientId}`);
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("UPDATE CLIENT ERROR:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update client" },
      { status: 500 }
    );
  }
}
