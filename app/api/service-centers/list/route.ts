import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
      SELECT 
        service_center_id AS center_id,
        center_code,
        center_name,
        email,
        created_at,
        updated_at
      FROM dbo.service_centers
      ORDER BY service_center_id DESC
    `);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });

  } catch (err: any) {
    console.error("SERVICE CENTER LIST ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
