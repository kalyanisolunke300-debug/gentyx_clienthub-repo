// /api/cpas/delete.ts (legacy - use cpas/delete/route.ts instead)
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { cpa_id } = await req.json();
    const pool = await getDbPool();
    const usage = await pool.query(`SELECT COUNT(*) AS total FROM public."Clients" WHERE cpa_id = $1`, [cpa_id]);
    if (parseInt(usage.rows[0].total) > 0) return NextResponse.json({ success: false, message: "Cannot delete: CPA is assigned to clients." }, { status: 400 });
    await pool.query(`DELETE FROM public."cpa_centers" WHERE cpa_id = $1`, [cpa_id]);
    return NextResponse.json({ success: true, message: "CPA deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
