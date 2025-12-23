// app/api/default-stage-templates/create/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const template_name = (body?.template_name ?? "").trim();
    const description = (body?.description ?? null) as string | null;

    if (!template_name) {
      return NextResponse.json(
        { success: false, error: "template_name is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // Optional: prevent duplicates
    const exists = await pool
      .request()
      .input("template_name", template_name)
      .query(`
        SELECT TOP 1 template_id
        FROM dbo.default_stage_templates
        WHERE template_name = @template_name AND is_active = 1
      `);

    if (exists.recordset.length > 0) {
      return NextResponse.json(
        { success: false, error: "Template name already exists" },
        { status: 409 }
      );
    }

    // Insert and return the created row
    const result = await pool
      .request()
      .input("template_name", template_name)
      .input("description", description)
      .query(`
        INSERT INTO dbo.default_stage_templates (template_name, description, is_active)
        OUTPUT INSERTED.template_id, INSERTED.template_name, INSERTED.description, INSERTED.is_active
        VALUES (@template_name, @description, 1)
      `);

    return NextResponse.json({ success: true, data: result.recordset[0] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
