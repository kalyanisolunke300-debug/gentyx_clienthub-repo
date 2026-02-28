// app/api/email-templates/delete/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing template id" }, { status: 400 });

    const pool = await getDbPool();
    const result = await pool.query(`DELETE FROM public."email_templates" WHERE template_id = $1`, [Number(id)]);
    return NextResponse.json({ success: true, rowsAffected: result.rowCount });
  } catch (error: any) {
    console.error("Delete email template error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
