import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");

    const pool = await getDbPool();
    const dbName = await pool.request().query("SELECT DB_NAME() AS db;");
    console.log("API Connected to DB:", dbName.recordset[0].db);

    const request = pool.request();

    if (clientId) {
      request.input("clientId", sql.Int, clientId);
    }

    const query = clientId
      ? `
          SELECT 
            m.message_id,
            m.client_id,
            c.client_name,
            m.sender_role,
            m.receiver_role,
            m.body,
            m.parent_message_id,
            m.attachment_url,
            m.attachment_name,
            m.created_at
          FROM dbo.onboarding_messages m
          LEFT JOIN dbo.clients c ON m.client_id = c.client_id
          WHERE m.client_id = @clientId
          ORDER BY m.created_at ASC
        `
      : `
          SELECT 
            m.message_id,
            m.client_id,
            c.client_name,
            m.sender_role,
            m.receiver_role,
            m.body,
            m.parent_message_id,
            m.attachment_url,
            m.attachment_name,
            m.created_at
          FROM dbo.onboarding_messages m
          LEFT JOIN dbo.clients c ON m.client_id = c.client_id
          ORDER BY m.created_at DESC
        `;

    const result = await request.query(query);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET /api/messages/get error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
