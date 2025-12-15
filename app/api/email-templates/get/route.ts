// app/api/email-templates/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query(`
      SELECT * FROM email_templates ORDER BY template_id DESC
    `);

    // Convert DB fields => frontend expected fields
    const formatted = result.recordset.map((row) => ({
      id: row.template_id,   
      name: row.name,
      subject: row.subject,
      body: row.body,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ success: true, data: formatted });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}