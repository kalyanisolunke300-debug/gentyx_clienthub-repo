///app/api/stages/list/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();
    const result = await pool.query(`SELECT stage_id, stage_name, order_number FROM public."onboarding_stages" ORDER BY order_number ASC`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("GET /api/stages/list error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch stage list" }, { status: 500 });
  }
}
