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

    // 1) Fetch stages for this client
    const stageResult = await pool.request()
      .input("clientId", sql.Int, clientId)
      .query(`
        SELECT 
          stage_id,
          stage_name,
          order_number,
          status,
          is_required
        FROM dbo.onboarding_stages
        WHERE client_id = @clientId
        ORDER BY order_number ASC
      `);

    const stages = stageResult.recordset;

    // 2) Fetch all tasks for this client
    const taskResult = await pool.request()
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

    const tasks = taskResult.recordset;

    // 3) Group tasks under each stage
    let totalTasks = 0;
    let completedTasks = 0;

    const stageData = stages.map(stage => {
      const sTasks = tasks.filter(t => t.stage_id === stage.stage_id);

      const sTotal = sTasks.length;
      const sCompleted = sTasks.filter(t => t.status === "Completed").length;

      totalTasks += sTotal;
      completedTasks += sCompleted;

      return {
        stage_id: stage.stage_id,
        stage_name: stage.stage_name,
        order_number: stage.order_number,
        status: stage.status,
        is_required: stage.is_required,
        totalTasks: sTotal,
        completedTasks: sCompleted,
        progress: sTotal === 0 ? 0 : Math.round((sCompleted / sTotal) * 100),
        tasks: sTasks
      };
    });

    // 4) Calculate overall progress
    const overallProgress =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return NextResponse.json({
      success: true,
      data: {
        stages: stageData,
        overallProgress,
      },
    });

  } catch (err) {
    console.error("GET /api/tasks/get error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
