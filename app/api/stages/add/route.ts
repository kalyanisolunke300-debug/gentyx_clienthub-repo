import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, stageName, isRequired, orderNumber } = body;

    if (!clientId || !stageName) {
      return NextResponse.json(
        { success: false, error: "clientId and stageName are required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    await pool.request()
      .input("clientId", sql.Int, clientId)
      .input("stageName", sql.VarChar(255), stageName)
      .input("isRequired", sql.Bit, isRequired ?? 1)
      .input("orderNumber", sql.Int, orderNumber ?? 1)
      .query(`
        INSERT INTO dbo.onboarding_stages 
        (client_id, stage_name, is_required, order_number, status, created_at)
        VALUES (@clientId, @stageName, @isRequired, @orderNumber, 'Pending', GETDATE());
      `);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("POST /api/stages/add error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add stage" },
      { status: 500 }
    );
  }
}
