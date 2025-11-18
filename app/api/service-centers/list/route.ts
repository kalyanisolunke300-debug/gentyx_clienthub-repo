import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
      SELECT 
        center_id AS id,
        center_name AS name,
        email,
        created_at
      FROM dbo.service_centers
      ORDER BY center_id DESC;
    `);

    return NextResponse.json({
      success: true,
      data: result.recordset
    });

  } catch (err: any) {
    console.error("GET /service-centers/list:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
