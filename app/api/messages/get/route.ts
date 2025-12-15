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
            message_id,
            client_id,
            sender_role,
            receiver_role,
            body,
            created_at
          FROM dbo.onboarding_messages
          WHERE client_id = @clientId
          ORDER BY created_at ASC
        `
      : `
          SELECT 
            message_id,
            client_id,
            sender_role,
            receiver_role,
            body,
            created_at
          FROM dbo.onboarding_messages
          ORDER BY created_at ASC
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
