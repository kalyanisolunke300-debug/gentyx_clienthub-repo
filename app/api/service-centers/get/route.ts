import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
      SELECT 
        service_center_id,
        center_name
      FROM service_centers
      ORDER BY center_name
    `);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
