// app/api/service-centers/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
      SELECT 
        sc.service_center_id,
        sc.center_name,
        LastMsg.created_at as last_message_at,
        LastMsg.body as last_message_body,
        LastMsg.sender_role as last_message_sender_role
      FROM service_centers sc
      OUTER APPLY (
        SELECT TOP 1 m.created_at, m.body, m.sender_role
        FROM dbo.onboarding_messages m
        WHERE m.service_center_id = sc.service_center_id
          AND (m.client_id IS NULL OR m.client_id = 0)
        ORDER BY m.created_at DESC
      ) LastMsg
      ORDER BY COALESCE(LastMsg.created_at, '1900-01-01') DESC, sc.center_name
    `);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
