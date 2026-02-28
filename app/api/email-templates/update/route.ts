// app/api/email-templates/update/route.ts

// New Updated code minor chages made
// app/api/email-templates/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    const { id, name, subject, body } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("template_id", Number(id))
      .input("name", name)
      .input("subject", subject)
      .input("body", body)
      .query(`
        UPDATE email_templates
        SET 
          name = @name,
          subject = @subject,
          body = @body,
          updated_at = NOW()
        WHERE template_id = @template_id
      `);

    return NextResponse.json({
      success: true,
      rowsAffected: result.rowCount,
    });

  } catch (error: any) {
    console.error("Email template update error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

