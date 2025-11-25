// app/api/tasks/get/route.ts

import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

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

    // 1️⃣ Fetch CLIENT STAGES (correct table)
    const stagesResult = await pool.request()
      .input("clientId", sql.Int, clientId)
      .query(`
        SELECT 
          client_stage_id,
          stage_name,
          order_number,
          status,
          is_required
        FROM dbo.client_stages
        WHERE client_id = @clientId
        ORDER BY order_number ASC
      `);

    const stages = stagesResult.recordset;

    // 2️⃣ Fetch TASKS for this client
    const tasksResult = await pool.request()
      .input("clientId", sql.Int, clientId)
      .query(`
        SELECT
          task_id,
          stage_id,
          task_title,
          assigned_to_role,
          due_date,
          status,
          order_number
        FROM dbo.onboarding_tasks
        WHERE client_id = @clientId
        ORDER BY stage_id, order_number ASC
      `);

    const tasks = tasksResult.recordset;

    // 3️⃣ Attach tasks to stages
    const stageData = stages.map(stage => ({
      ...stage,
      tasks: tasks.filter(t => t.stage_id === stage.client_stage_id)
    }));

    // 4️⃣ COUNT PROGRESS
    const totalTasks = tasks.length;
    const completed = tasks.filter(t => t.status === "Completed").length;

    const overallProgress =
      totalTasks === 0 ? 0 : Math.round((completed / totalTasks) * 100);

    return NextResponse.json({
      success: true,
      data: {
        stages: stageData,
        overallProgress,
      },
    });

  } catch (err: any) {
    console.error("GET /api/tasks/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
