// app/api/tasks/list/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
      SELECT 
        task_id AS id,
        stage_id AS stageId,
        client_id AS clientId,
        task_title AS title,
        assigned_to_role AS assigneeRole,
        status,
        due_date AS dueDate,
        created_at
      FROM dbo.onboarding_tasks
      ORDER BY created_at DESC;
    `);

    return NextResponse.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
      page: 1,
      pageSize: result.recordset.length,
    });

  } catch (err: any) {
    console.error("GET /api/tasks/list error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
