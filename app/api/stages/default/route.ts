///app/api/stages/default/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    const query = `
      SELECT 
        stage_id,
        stage_name,
        order_number,
        is_required
      FROM onboarding_stages
      ORDER BY order_number ASC;
    `;

    const result = await pool.request().query(query);

    return NextResponse.json({
      success: true,
      data: result.recordset
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
