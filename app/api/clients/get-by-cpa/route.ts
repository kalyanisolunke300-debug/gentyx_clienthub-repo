// /app/api/clients/get-by-cpa/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cpaId = searchParams.get("cpaId");

    if (!cpaId) {
      return NextResponse.json(
        { success: false, error: "CPA ID is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("cpa_id", Number(cpaId))
      .query(`
        SELECT 
          c.client_id,
          c.client_name,
          c.code,
          c.client_status,
          c.status,
          c.primary_contact_email,
          LastMsg.created_at as last_message_at,
          LastMsg.body as last_message_body,
          LastMsg.sender_role as last_message_sender_role
        FROM dbo.Clients c
        OUTER APPLY (
          SELECT TOP 1 m.created_at, m.body, m.sender_role
          FROM dbo.onboarding_messages m
          WHERE m.client_id = c.client_id
            AND (m.cpa_id = @cpa_id OR m.cpa_id IS NULL) -- Include generic messages if applicable, but mostly specific
            -- Actually, simpler to just check client_id because this is "Get Clients assigned to CPA"
            -- But we only want messages RELEVANT to this CPA? 
            -- If I see a message from Admin to Client, should CPA see it? Maybe. 
            -- Safe bet: just get last message for the client.
            -- Re-reading requirements: "mimicking ... WhatsApp" means seeing the conversation.
            -- I will restrict to messages involving CPA if possible, but usually Client chats are one big stream.
            -- However, usually CPAs only see messages they are part of.
            -- I'll filter by m.cpa_id = @cpa_id OR generic (null).
             AND (m.cpa_id = c.cpa_id OR m.cpa_id IS NULL)
          ORDER BY m.created_at DESC
        ) LastMsg
        WHERE c.cpa_id = @cpa_id
        ORDER BY COALESCE(LastMsg.created_at, '1900-01-01') DESC, c.client_name ASC
      `);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });
  } catch (err: any) {
    console.error("GET BY CPA ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
