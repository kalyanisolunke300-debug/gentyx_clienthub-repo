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

    const result = await pool.query(`
        SELECT 
          c.client_id,
          c.client_name,
          c.code,
          c.client_status,
          c.status,
          c.primary_contact_email,
          lm.created_at as last_message_at,
          lm.body as last_message_body,
          lm.sender_role as last_message_sender_role
        FROM public."Clients" c
        LEFT JOIN LATERAL (
          SELECT m.created_at, m.body, m.sender_role
          FROM public."onboarding_messages" m
          WHERE m.client_id = c.client_id
            AND (m.cpa_id = c.cpa_id OR m.cpa_id IS NULL)
          ORDER BY m.created_at DESC
          LIMIT 1
        ) lm ON true
        WHERE c.cpa_id = $1
        ORDER BY COALESCE(lm.created_at, '1900-01-01'::timestamp) DESC, c.client_name ASC
      `, [Number(cpaId)]);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (err: any) {
    console.error("GET BY CPA ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
