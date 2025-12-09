// app/api/tasks/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const taskId = searchParams.get("taskId");

    const pool = await getDbPool();

    // ✅ CASE 1: FETCH SINGLE TASK (FOR EDIT)
    if (taskId) {
      const result = await pool.request()
        .input("taskId", sql.Int, Number(taskId))
        .query(`
          SELECT 
            task_id,
            task_title,
            client_id,
            assigned_to_role,
            due_date,
            status
          FROM dbo.onboarding_tasks
          WHERE task_id = @taskId
        `);

      return NextResponse.json(result.recordset[0] || null);
    }

    // ✅ CASE 2: FETCH TASKS BY CLIENT (EXISTING BEHAVIOR)
    if (clientId) {
      const result = await pool.request()
        .input("clientId", sql.Int, Number(clientId))
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
        data: result.recordset,
      });
    }

    // ❌ NO PARAM PROVIDED
    return NextResponse.json(
      { success: false, error: "clientId or taskId is required" },
      { status: 400 }
    );

  } catch (err: any) {
    console.error("GET /api/tasks/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
