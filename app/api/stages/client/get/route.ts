// /app/api/stages/client/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client ID required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const stages = await pool
      .request()
      .input("clientId", sql.Int, Number(clientId))
      .query(`
        SELECT client_stage_id, stage_name, order_number, is_required, status
        FROM client_stages
        WHERE client_id = @clientId
        ORDER BY order_number
      `);

    const subtasks = await pool
      .request()
      .input("clientId", sql.Int, Number(clientId))
      .query(`
        SELECT s.client_stage_id, t.subtask_title, t.status
        FROM client_stages s
        LEFT JOIN client_stage_subtasks t
          ON s.client_stage_id = t.client_stage_id
        WHERE s.client_id = @clientId
        ORDER BY s.order_number, t.order_number
      `);

    return NextResponse.json({
      success: true,
      data: stages.recordset,
      subtasks: subtasks.recordset,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
