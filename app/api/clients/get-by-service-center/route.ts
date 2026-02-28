// app/api/clients/get-by-service-center/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceCenterId = searchParams.get("serviceCenterId");

    if (!serviceCenterId) {
      return NextResponse.json(
        { success: false, error: "serviceCenterId is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool.query(`
        SELECT
          c.client_id,
          c.client_name,
          c.code,
          c.status,
          c.client_status,
          c.created_at,
          c.primary_contact_email,
          lm.created_at as last_message_at,
          lm.body as last_message_body,
          lm.sender_role as last_message_sender_role
        FROM public."Clients" c
        LEFT JOIN LATERAL (
          SELECT m.created_at, m.body, m.sender_role
          FROM public."onboarding_messages" m
          WHERE m.client_id = c.client_id
            AND (m.service_center_id = $1 OR m.service_center_id IS NULL)
          ORDER BY m.created_at DESC
          LIMIT 1
        ) lm ON true
        WHERE c.service_center_id = $1
        ORDER BY COALESCE(lm.created_at, c.created_at) DESC
      `, [Number(serviceCenterId)]);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });

  } catch (err) {
    console.error("GET CLIENTS BY SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assigned clients" },
      { status: 500 }
    );
  }
}
