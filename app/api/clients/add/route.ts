// app/api/clients/add/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { sendClientWelcomeEmail } from "@/lib/email";

type AssociatedUser = {
  name: string;
  email: string;
  role?: string;
  phone?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      clientName,
      code,
      slaNumber,
      primaryContactFirstName,
      primaryContactLastName,
      primaryContactName,
      primaryContactEmail,
      primaryContactPhone,
      serviceCenterId,
      cpaId,
      stageId,
      associatedUsers,
    } = body;

    const fullContactName = primaryContactName || `${primaryContactFirstName || ''} ${primaryContactLastName || ''}`.trim();
    const trimmedClientName = clientName?.trim();
    const finalClientName = trimmedClientName || fullContactName;

    if (!finalClientName || !primaryContactEmail) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ✅ CHECK FOR DUPLICATE CLIENT NAME (CASE-INSENSITIVE)
    const existingClient = await pool.query(`
        SELECT client_id, client_name 
        FROM public."Clients" 
        WHERE LOWER(client_name) = LOWER($1)
      `, [finalClientName]);

    if (existingClient.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `A client named "${existingClient.rows[0].client_name}" already exists`
        },
        { status: 409 }
      );
    }

    // ✅ CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES
    const existingEmail = await pool.query(`
        SELECT 'client' as entity_type, client_name as name FROM public."Clients" 
        WHERE LOWER(primary_contact_email) = $1
        UNION ALL
        SELECT 'CPA' as entity_type, cpa_name as name FROM public."cpa_centers" 
        WHERE LOWER(email) = $1
        UNION ALL
        SELECT 'service center' as entity_type, center_name as name FROM public."service_centers" 
        WHERE LOWER(email) = $1
      `, [primaryContactEmail.trim().toLowerCase()]);

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

    /* -------------------------------------------------
       INSERT CLIENT
    -------------------------------------------------- */
    const clientResult = await pool.query(`
        INSERT INTO public."Clients" (
          client_name,
          code,
          client_status,
          sla_number,
          primary_contact_first_name,
          primary_contact_last_name,
          primary_contact_name,
          primary_contact_email,
          primary_contact_phone,
          created_at,
          updated_at,
          stage_id,
          progress,
          status,
          cpa_id,
          service_center_id
        )
        VALUES (
          $1, $2, 'Active', $3, $4, $5, $6, $7, $8,
          NOW(), NOW(), $9, 0, 'Active', $10, $11
        )
        RETURNING client_id;
      `, [
      finalClientName,
      code || null,
      slaNumber || null,
      primaryContactFirstName || null,
      primaryContactLastName || null,
      fullContactName,
      primaryContactEmail,
      primaryContactPhone,
      stageId || null,
      cpaId || null,
      serviceCenterId || null
    ]);

    const clientId = clientResult.rows[0].client_id;

    /* -------------------------------------------------
        INSERT USER FOR CLIENT LOGIN (TESTING ONLY)
      -------------------------------------------------- */
    const existingUser = await pool.query(`
          SELECT id FROM public."Users" WHERE email = $1
        `, [primaryContactEmail]);

    if (existingUser.rows.length === 0) {
      await pool.query(`
            INSERT INTO public."Users" (email, password, role)
            VALUES ($1, $2, $3)
          `, [primaryContactEmail, "ClientHub@2025", "CLIENT"]);

      // 📧 Send welcome email to the client
      try {
        const emailResult = await sendClientWelcomeEmail(
          primaryContactEmail,
          fullContactName,
          finalClientName,
          code || undefined
        );
        if (emailResult?.success) {
          console.log(`✅ Welcome email sent to client: ${primaryContactEmail}`);
        } else {
          console.error(`⚠️ Welcome email failed for client: ${primaryContactEmail}`, emailResult?.error || 'Unknown error');
        }
      } catch (emailError) {
        console.error(`⚠️ Failed to send welcome email to client: ${primaryContactEmail}`, emailError);
      }
    }

    /* -------------------------------------------------
       INSERT DEFAULT TASKS FOR STAGE
    -------------------------------------------------- */
    if (stageId) {
      try {
        await pool.query(`
            INSERT INTO public."onboarding_tasks" (
              stage_id,
              client_id,
              task_title,
              due_date,
              assigned_to_role,
              status,
              order_number,
              created_at
            )
            SELECT
              t.stage_id,
              $1,
              t.task_title,
              NULL,
              t.assigned_to_role,
              'Pending',
              t.order_number,
              NOW()
            FROM public."stage_tasks" t
            WHERE t.stage_id = $2;
          `, [clientId, stageId]);
      } catch (err) {
        console.error("Warning: failed to seed default tasks", err);
      }
    }

    /* -------------------------------------------------
       INSERT ASSOCIATED USERS
    -------------------------------------------------- */
    if (Array.isArray(associatedUsers)) {
      for (const user of associatedUsers as AssociatedUser[]) {
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
            VALUES ($1, $2, $3, $4, $5, NOW());
          `, [clientId, user.name, user.email, user.role || "Client User", user.phone || null]);
      }
      console.log(`✅ Added ${associatedUsers.length} associated users for client ID: ${clientId}`);
    }

    return NextResponse.json({ success: true, clientId });

  } catch (err: any) {
    console.error("POST /api/clients/add error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create client" },
      { status: 500 }
    );
  }
}
