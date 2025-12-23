// app/api/tasks/client/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool.request()
      .input("clientId", sql.Int, clientId)
      .query(`
        SELECT
          task_id,
          task_title,
          assigned_to_role,
          due_date,
          status
        FROM dbo.onboarding_tasks
        WHERE client_id = @clientId
        ORDER BY task_id DESC
      `);

    return NextResponse.json({
      success: true,
      data: result.recordset
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
