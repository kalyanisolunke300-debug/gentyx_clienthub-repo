// app/api/cpas/add.ts (legacy - use cpas/add/route.ts instead)
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();
    const pool = await getDbPool();

    const last = await pool.query(`SELECT cpa_code FROM public."cpa_centers" ORDER BY cpa_id DESC LIMIT 1`);
    let nextCode = "CPA001";
    if (last.rows.length > 0) {
      const num = parseInt(last.rows[0].cpa_code.replace("CPA", "")) + 1;
      nextCode = "CPA" + num.toString().padStart(3, "0");
    }

    await pool.query(`INSERT INTO public."cpa_centers" (cpa_code, cpa_name, email, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`, [nextCode, name, email]);
    return NextResponse.json({ success: true, message: "CPA created successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
