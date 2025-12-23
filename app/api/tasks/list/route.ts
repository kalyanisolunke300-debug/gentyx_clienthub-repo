// app/api/tasks/list/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET() {
  try {
    const pool = await getDbPool();

    const result = await pool.request().query(`
      SELECT
        t.task_id AS id,
        t.stage_id AS stageId,
        t.client_id AS clientId,
        c.client_name AS clientName,
        t.task_title AS title,
        t.assigned_to_role AS assigneeRole,
        t.status,
        t.due_date AS dueDate,
        t.created_at
      FROM dbo.onboarding_tasks t
      LEFT JOIN dbo.clients c
        ON t.client_id = c.client_id
      ORDER BY t.created_at DESC;
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

