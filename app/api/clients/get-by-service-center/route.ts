// app/api/clients/get-by-service-center/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

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

    const result = await pool
      .request()
      .input("service_center_id", sql.Int, Number(serviceCenterId))
      .query(`
        SELECT
          c.client_id,
          c.client_name,
          c.code,
          c.status,
          c.client_status,
          c.created_at,
          c.primary_contact_email,
          LastMsg.created_at as last_message_at,
          LastMsg.body as last_message_body,
          LastMsg.sender_role as last_message_sender_role
        FROM dbo.Clients c
        OUTER APPLY (
          SELECT TOP 1 m.created_at, m.body, m.sender_role
          FROM dbo.onboarding_messages m
          WHERE m.client_id = c.client_id
            AND (m.service_center_id = @service_center_id OR m.service_center_id IS NULL)
          ORDER BY m.created_at DESC
        ) LastMsg
        WHERE c.service_center_id = @service_center_id
        ORDER BY COALESCE(LastMsg.created_at, c.created_at) DESC
      `);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });

  } catch (err) {
    console.error("GET CLIENTS BY SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assigned clients" },
      { status: 500 }
    );
  }
}
