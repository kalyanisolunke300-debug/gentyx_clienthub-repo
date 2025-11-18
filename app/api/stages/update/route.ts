import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stageId, stageName, orderNumber, status } = body;

    if (!stageId) {
      return NextResponse.json(
        { success: false, error: "stageId is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    await pool.request()
      .input("stageId", sql.Int, stageId)
      .input("stageName", sql.VarChar(255), stageName)
      .input("orderNumber", sql.Int, orderNumber)
      .input("status", sql.VarChar(50), status)
      .query(`
        UPDATE dbo.onboarding_stages
        SET 
          stage_name = COALESCE(@stageName, stage_name),
          order_number = COALESCE(@orderNumber, order_number),
          status = COALESCE(@status, status),
          updated_at = GETDATE()
        WHERE stage_id = @stageId;
      `);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("POST /api/stages/update error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update stage" },
      { status: 500 }
    );
  }
}
