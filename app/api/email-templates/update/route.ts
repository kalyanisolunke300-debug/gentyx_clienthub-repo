// app/api/email-templates/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    const { id, name, subject, body } = await req.json();

    const pool = await getDbPool();

    await pool.request()
    .input("id", Number(id))     
    .input("name", name)
    .input("subject", subject)
    .input("body", body)
    .query(`
        UPDATE email_templates
        SET name = @name,
            subject = @subject,
            body = @body
        WHERE id = @id
    `);


    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
