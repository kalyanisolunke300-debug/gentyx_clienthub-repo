// app/api/default-stage-templates/list/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
      SELECT template_id, template_name, description, is_active
      FROM dbo.default_stage_templates
      WHERE is_active = 1
      ORDER BY template_name
    `);

    return NextResponse.json({ success: true, data: result.recordset });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

