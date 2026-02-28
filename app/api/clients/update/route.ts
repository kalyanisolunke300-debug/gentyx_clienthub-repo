// app/api/clients/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
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

    const fullContactName = primary_contact_name ||
      `${primary_contact_first_name || ''} ${primary_contact_last_name || ''}`.trim();
    const trimmedClientName = client_name?.trim();
    const finalClientName = trimmedClientName || fullContactName;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client ID missing" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ✅ CHECK FOR DUPLICATE CLIENT NAME (CASE-INSENSITIVE, EXCLUDING CURRENT)
    if (finalClientName) {
      const existingClient = await pool.query(`
          SELECT client_id, client_name 
          FROM public."Clients" 
          WHERE LOWER(client_name) = LOWER($1)
          AND client_id != $2
        `, [finalClientName, Number(clientId)]);

      if (existingClient.rows.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `A client named "${existingClient.rows[0].client_name}" already exists`
          },
          { status: 409 }
        );
      }
    }

    // ✅ CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (EXCLUDING CURRENT CLIENT)
    if (primary_contact_email && primary_contact_email.trim()) {
      const existingEmail = await pool.query(`
          SELECT 'client' as entity_type, client_name as name FROM public."Clients" 
          WHERE LOWER(primary_contact_email) = $1 AND client_id != $2
          UNION ALL
          SELECT 'CPA' as entity_type, cpa_name as name FROM public."cpa_centers" 
          WHERE LOWER(email) = $1
          UNION ALL
          SELECT 'service center' as entity_type, center_name as name FROM public."service_centers" 
          WHERE LOWER(email) = $1
        `, [primary_contact_email.trim().toLowerCase(), Number(clientId)]);

      if (existingEmail.rows.length > 0) {
        const existing = existingEmail.rows[0];
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
    const oldEmailResult = await pool.query(
      `SELECT primary_contact_email FROM public."Clients" WHERE client_id = $1`,
      [Number(clientId)]
    );
    const oldEmail = oldEmailResult.rows[0]?.primary_contact_email;

    await pool.query(`
        UPDATE public."Clients"
        SET
          client_name = $1,
          code = $2,
          primary_contact_first_name = $3,
          primary_contact_last_name = $4,
          primary_contact_name = $5,
          primary_contact_email = $6,
          primary_contact_phone = $7,
          service_center_id = $8,
          cpa_id = $9,
          updated_at = NOW()
        WHERE client_id = $10
      `, [
      finalClientName,
      code,
      primary_contact_first_name || null,
      primary_contact_last_name || null,
      fullContactName,
      primary_contact_email,
      primary_contact_phone,
      service_center_id || null,
      cpa_id || null,
      Number(clientId)
    ]);

    // 📧 SYNC EMAIL TO USERS TABLE (for login credentials)
    if (primary_contact_email && primary_contact_email.trim() && oldEmail &&
      primary_contact_email.toLowerCase() !== oldEmail.toLowerCase()) {
      await pool.query(`
          UPDATE public."Users" 
          SET email = $1 
          WHERE email = $2 AND role = 'CLIENT'
        `, [primary_contact_email, oldEmail]);
      console.log(`✅ Client login email updated from ${oldEmail} to ${primary_contact_email}`);
    }

    // Audit logs
    logAudit({
      clientId,
      action: AuditActions.CLIENT_UPDATED,
      actorRole: "ADMIN",
      details: finalClientName,
    });

    if (service_center_id) {
      logAudit({
        clientId,
        action: AuditActions.SERVICE_CENTER_ASSIGNED,
        actorRole: "ADMIN",
      });
    }

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
        const emailResult = await sendUpdateNotification({
          recipientEmail: primary_contact_email,
          recipientName: primary_contact_name || finalClientName,
          updateType: 'profile_updated',
          details: {
            title: 'Your Profile Has Been Updated',
            description: `Your client profile "${finalClientName}" has been updated by the administrator. If you did not expect this change, please contact support.`,
            actionUrl: 'https://legacy.hubonesystems.net/login',
            actionLabel: 'View Your Profile',
          },
        });
        if (emailResult?.success) {
          console.log(`✅ Profile update notification sent to client: ${primary_contact_email}`);
        } else {
          console.error(`⚠️ Profile update notification failed for client: ${primary_contact_email}`, emailResult?.error || 'Unknown error');
        }
      } catch (emailError) {
        console.error(`⚠️ Failed to send profile update notification to client: ${primary_contact_email}`, emailError);
      }
    }

    // 5️⃣ Update Associated Users (if provided)
    const associatedUsers = body.associatedUsers;
    if (Array.isArray(associatedUsers)) {
      // Delete existing associated users for this client
      await pool.query(
        `DELETE FROM public."client_users" WHERE client_id = $1`,
        [Number(clientId)]
      );

      // Insert new associated users
      for (const user of associatedUsers) {
        if (!user.name || !user.email) continue;

        await pool.query(`
            INSERT INTO public."client_users" (
              client_id,
              user_name,
              email,
              role,
              phone,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [Number(clientId), user.name, user.email, user.role || "Client User", user.phone || null]);
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
