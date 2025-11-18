// /api/cpas/get.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
    SELECT 
        c.cpa_id,
        c.cpa_code,
        c.cpa_name,
        c.email,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM dbo.Clients cl WHERE cl.cpa_id = c.cpa_id) AS client_count
    FROM dbo.cpa_centers c
    ORDER BY c.cpa_id ASC
    `);


    return NextResponse.json({ success: true, data: result.recordset });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
