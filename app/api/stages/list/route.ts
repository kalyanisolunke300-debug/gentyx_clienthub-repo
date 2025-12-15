///app/api/stages/list/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
      SELECT stage_id, stage_name, order_number
      FROM dbo.onboarding_stages
      ORDER BY order_number ASC;
    `);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });

  } catch (err) {
    console.error("GET /api/stages/list error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stage list" },
      { status: 500 }
    );
  }
}
