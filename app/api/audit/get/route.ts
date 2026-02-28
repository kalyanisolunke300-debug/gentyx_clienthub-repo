//app/api/audit/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");

    const pool = await getDbPool();

    let query = "";
    const values: any[] = [];

    if (clientId) {
      query = `
          SELECT 
            audit_id AS id,
            client_id,
            action,
            actor_role,
            created_at AS at
          FROM public."onboarding_audit_log"
          WHERE client_id = $1
          ORDER BY created_at DESC
        `;
      values.push(clientId);
    } else {
      query = `
          SELECT 
            audit_id AS id,
            client_id,
            action,
            actor_role,
            created_at AS at
          FROM public."onboarding_audit_log"
          ORDER BY created_at DESC
        `;
    }

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("GET /api/audit/get error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
