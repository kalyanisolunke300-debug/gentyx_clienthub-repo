// app/api/tasks/list/route.ts
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
          task_id AS id,
          client_id AS clientId,
          task_title AS title,
          assigned_to_role AS assigneeRole,
          status,
          due_date AS dueDate
        FROM dbo.onboarding_tasks
        WHERE client_id = @clientId
        ORDER BY created_at DESC;
      `);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });

  } catch (err: any) {
    console.error("GET /api/tasks/list error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
