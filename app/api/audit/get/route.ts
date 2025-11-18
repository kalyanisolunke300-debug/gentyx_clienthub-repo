import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");

    const pool = await getDbPool();
    const request = pool.request();

    if (clientId) {
      request.input("clientId", sql.VarChar(50), clientId);
    }

    const query = clientId
      ? `
          SELECT 
            audit_id AS id,
            client_id,
            action,
            actor_role,
            created_at AS at
          FROM dbo.onboarding_audit_log
          WHERE client_id = @clientId
          ORDER BY created_at DESC
        `
      : `
          SELECT 
            audit_id AS id,
            client_id,
            action,
            actor_role,
            created_at AS at
          FROM dbo.onboarding_audit_log
          ORDER BY created_at DESC
        `;

    const result = await request.query(query);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET /api/audit/get error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
