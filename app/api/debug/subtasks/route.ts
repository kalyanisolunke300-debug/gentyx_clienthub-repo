import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();
    const result = await pool.query(`SELECT * FROM public."client_stage_subtasks" ORDER BY subtask_id DESC LIMIT 50`);
    return NextResponse.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
