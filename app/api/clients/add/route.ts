// app/api/clients/add/route.ts
import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

type AssociatedUser = {
  name: string;
  email: string;
  role?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // FRONTEND FIX:
    // serviceCenterId   ---> service_center_id
    // stageId           ---> stageId
    // Everything else same
    const {
      clientName,
      code,
      slaNumber,
      primaryContactName,
      primaryContactEmail,
      primaryContactPhone,
      serviceCenterId,  // FRONTEND FIELD NAME
      cpaId,
      stageId,
      associatedUsers,
    } = body;

    if (!clientName || !primaryContactName || !primaryContactEmail) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ✅ CHECK FOR DUPLICATE CLIENT NAME (CASE-INSENSITIVE)
    const existingClient = await pool
      .request()
      .input("clientName", sql.NVarChar(255), clientName.trim())
      .query(`
        SELECT client_id, client_name 
        FROM dbo.clients 
        WHERE LOWER(client_name) = LOWER(@clientName)
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

    // ✅ CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES
    const existingEmail = await pool
      .request()
      .input("email", sql.NVarChar(255), primaryContactEmail.trim().toLowerCase())
      .query(`
        SELECT 'client' as entity_type, client_name as name FROM dbo.clients 
        WHERE LOWER(primary_contact_email) = @email
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

    /* -------------------------------------------------
       INSERT CLIENT
    -------------------------------------------------- */
    const clientResult = await pool
      .request()
      .input("clientName", sql.NVarChar(255), clientName)
      .input("code", sql.NVarChar(50), code || null)
      .input("slaNumber", sql.NVarChar(50), slaNumber || null)
      .input("primaryContactName", sql.NVarChar(255), primaryContactName)
      .input("primaryContactEmail", sql.NVarChar(255), primaryContactEmail)
      .input("primaryContactPhone", sql.NVarChar(50), primaryContactPhone)
      .input("service_center_id", sql.Int, serviceCenterId || null)
      .input("cpaId", sql.Int, cpaId || null)
      .input("stageId", sql.Int, stageId || null)
      .query(`
        INSERT INTO dbo.clients (
          client_name,
          code,
          client_status,
          sla_number,
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
        OUTPUT INSERTED.client_id
        VALUES (
          @clientName,
          @code,
          'Active',
          @slaNumber,
          @primaryContactName,
          @primaryContactEmail,
          @primaryContactPhone,
          GETDATE(),
          GETDATE(),
          @stageId,
          0,
          'Active',
          @cpaId,
          @service_center_id
        );
      `);

    const clientId = clientResult.recordset[0].client_id;
    /* -------------------------------------------------
        INSERT USER FOR CLIENT LOGIN (TESTING ONLY)
      -------------------------------------------------- */

    // Check if user already exists
    const existingUser = await pool
      .request()
      .input("email", sql.NVarChar(255), primaryContactEmail)
      .query(`
          SELECT id FROM dbo.Users WHERE email = @email
        `);

    if (existingUser.recordset.length === 0) {
      await pool
        .request()
        .input("email", sql.NVarChar(255), primaryContactEmail)
        .input("password", sql.NVarChar(255), "ClientHub@2025") // testing password
        .input("role", sql.NVarChar(50), "CLIENT")
        .query(`
            INSERT INTO dbo.Users (email, password, role)
            VALUES (@email, @password, @role)
          `);
    }

    /* -------------------------------------------------
       INSERT DEFAULT TASKS FOR STAGE
    -------------------------------------------------- */
    if (stageId) {
      try {
        await pool
          .request()
          .input("clientId", sql.Int, clientId)
          .input("stageId", sql.Int, stageId)
          .query(`
            INSERT INTO dbo.onboarding_tasks (
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
              @clientId,
              t.task_title,
              NULL,
              t.assigned_to_role,
              'Pending',
              t.order_number,
              GETDATE()
            FROM dbo.stage_tasks t
            WHERE t.stage_id = @stageId;
          `);
      } catch (err) {
        console.error("Warning: failed to seed default tasks", err);
      }
    }

    /* -------------------------------------------------
       INSERT ASSOCIATED USERS
    -------------------------------------------------- */
    if (Array.isArray(associatedUsers)) {
      for (const user of associatedUsers) {
        if (!user.name || !user.email) continue;

        await pool
          .request()
          .input("clientId", sql.Int, clientId)
          .input("name", sql.NVarChar(255), user.name)
          .input("email", sql.NVarChar(255), user.email)
          .input("role", sql.NVarChar(50), user.role || "Client User")
          .query(`
            INSERT INTO dbo.client_users (
              client_id,
              user_name,
              email,
              role,
              created_at
            )
            VALUES (
              @clientId,
              @name,
              @email,
              @role,
              GETDATE()
            );
          `);
      }
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
