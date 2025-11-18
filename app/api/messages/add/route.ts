import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const { client_id, sender_role, receiver_role, body } = await req.json();

    const pool = await getDbPool();
    await pool.request()
      .input("client_id", sql.Int, client_id)
      .input("sender_role", sql.VarChar(50), sender_role)
      .input("receiver_role", sql.VarChar(50), receiver_role)
      .input("body", sql.NVarChar(sql.MAX), body)
      .query(`
        INSERT INTO dbo.onboarding_messages 
        (client_id, sender_role, receiver_role, body)
        VALUES (@client_id, @sender_role, @receiver_role, @body)
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/messages/add error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
