// /api/cpas/get.ts (legacy - use cpas/get/route.ts instead)
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();
    const result = await pool.query(`SELECT c.cpa_id, c.cpa_code, c.cpa_name, c.email, c.created_at, c.updated_at, (SELECT COUNT(*) FROM public."Clients" cl WHERE cl.cpa_id = c.cpa_id) AS client_count FROM public."cpa_centers" c ORDER BY c.cpa_id ASC`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
