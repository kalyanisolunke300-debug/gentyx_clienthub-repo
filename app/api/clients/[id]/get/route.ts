import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("clientId", sql.Int, id)
      .query(`
        SELECT
          c.client_id,
          c.client_name,
          c.code,
          c.client_status,
          c.sla_number,
          c.primary_contact_name,
          c.primary_contact_email,
          c.primary_contact_phone,
          c.created_at,
          c.updated_at,
          c.service_center_id,
          c.cpa_id,
          c.stage_id,
          c.progress,
          c.status,
          s.stage_name
        FROM dbo.Clients AS c
        LEFT JOIN dbo.onboarding_stages AS s
          ON c.stage_id = s.stage_id
        WHERE c.client_id = @clientId;
      `);

    const row = result.recordset[0];

    if (!row) {
      return NextResponse.json(
        { success: false, error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: row,
    });

  } catch (err) {
    console.error("GET client error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}
