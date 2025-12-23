// app/api/clients/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      clientId,
      client_name,
      code,
      primary_contact_name,
      primary_contact_email,
      primary_contact_phone,
      service_center_id,
      cpa_id,
    } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client ID missing" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    await pool
      .request()
      .input("client_id", sql.Int, Number(clientId))
      .input("client_name", sql.NVarChar, client_name)
      .input("code", sql.NVarChar, code)
      .input("primary_contact_name", sql.NVarChar, primary_contact_name)
      .input("primary_contact_email", sql.NVarChar, primary_contact_email)
      .input("primary_contact_phone", sql.NVarChar, primary_contact_phone)
      .input("service_center_id", sql.Int, service_center_id || null)
      .input("cpa_id", sql.Int, cpa_id || null)
      .query(`
        UPDATE dbo.Clients
        SET
          client_name = @client_name,
          code = @code,
          primary_contact_name = @primary_contact_name,
          primary_contact_email = @primary_contact_email,
          primary_contact_phone = @primary_contact_phone,
          service_center_id = @service_center_id,
          cpa_id = @cpa_id,
          updated_at = GETDATE()
        WHERE client_id = @client_id
      `);

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

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("UPDATE CLIENT ERROR:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update client" },
      { status: 500 }
    );
  }
}
