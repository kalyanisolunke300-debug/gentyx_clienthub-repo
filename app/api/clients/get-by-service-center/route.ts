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
          client_id,
          client_name,
          code,
          status,
          client_status,
          created_at
        FROM dbo.Clients
        WHERE service_center_id = @service_center_id
        ORDER BY created_at DESC
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
