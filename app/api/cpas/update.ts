// /api/cpas/update.ts (legacy - use cpas/update/route.ts instead)
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    const { cpa_id, name, email } = await req.json();
    const pool = await getDbPool();
    await pool.query(`UPDATE public."cpa_centers" SET cpa_name = $1, email = $2, updated_at = NOW() WHERE cpa_id = $3`, [name, email, cpa_id]);
    return NextResponse.json({ success: true, message: "CPA updated successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
