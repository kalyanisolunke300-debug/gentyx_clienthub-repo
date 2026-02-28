// /api/cpas/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.query(`
      SELECT 
        c.cpa_id,
        c.cpa_code,
        c.cpa_name,
        c.email,
        c.created_at,
        c.updated_at,
        (
          SELECT COUNT(*) 
          FROM public."Clients" cl 
          WHERE cl.cpa_id = c.cpa_id
        ) AS client_count,
        "LastMsg".created_at as last_message_at,
        "LastMsg".body as last_message_body,
        "LastMsg".sender_role as last_message_sender_role
      FROM public."cpa_centers" c
      LEFT JOIN (
          SELECT 
             m.cpa_id,
             m.created_at, 
             m.body, 
             m.sender_role,
             ROW_NUMBER() OVER (PARTITION BY m.cpa_id ORDER BY m.created_at DESC) as rn
          FROM public."onboarding_messages" m
          WHERE (m.client_id IS NULL OR m.client_id = 0)
            AND m.cpa_id IS NOT NULL
      ) "LastMsg" ON "LastMsg".cpa_id = c.cpa_id AND "LastMsg".rn = 1
      ORDER BY COALESCE("LastMsg".created_at, '1900-01-01'::timestamp) DESC, c.cpa_name;
    `);

    return NextResponse.json({
      success: true,
      data: result.rows
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
