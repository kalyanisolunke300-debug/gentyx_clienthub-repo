// app/api/documents/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query(`
      SELECT * FROM dbo.client_documents ORDER BY uploaded_at DESC
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
