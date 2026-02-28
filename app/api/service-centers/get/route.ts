// app/api/service-centers/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.query(`
      SELECT 
        sc.service_center_id,
        sc.center_name,
        lm.created_at as last_message_at,
        lm.body as last_message_body,
        lm.sender_role as last_message_sender_role
      FROM public."service_centers" sc
      LEFT JOIN LATERAL (
        SELECT m.created_at, m.body, m.sender_role
        FROM public."onboarding_messages" m
        WHERE m.service_center_id = sc.service_center_id
          AND (m.client_id IS NULL OR m.client_id = 0)
        ORDER BY m.created_at DESC
        LIMIT 1
      ) lm ON true
      ORDER BY COALESCE(lm.created_at, '1900-01-01'::timestamp) DESC, sc.center_name
    `);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
