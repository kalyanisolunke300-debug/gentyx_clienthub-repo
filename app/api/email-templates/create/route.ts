// app/api/email-templates/create/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { name, subject, body } = await req.json();

    const pool = await getDbPool(); // ✅ FIXED (await + pool)

    await pool.request()
      .input("name", name)
      .input("subject", subject)
      .input("body", body)
      .query(`
        INSERT INTO email_templates (name, subject, body)
        VALUES (@name, @subject, @body)
      `);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
