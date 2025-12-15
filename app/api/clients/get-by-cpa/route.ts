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
          client_id,
          client_name,
          code,
          client_status,
          status
        FROM dbo.Clients
        WHERE cpa_id = @cpa_id
        ORDER BY client_name ASC
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
