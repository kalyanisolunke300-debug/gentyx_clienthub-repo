import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
      SELECT TOP 50 *
      FROM client_stage_subtasks
      ORDER BY subtask_id DESC
    `);

    return NextResponse.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
