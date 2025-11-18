import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = Number(searchParams.get("clientId"));

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // Fetch stages
    const stagesResult = await pool.request()
      .input("clientId", sql.Int, clientId)
      .query(`
        SELECT * 
        FROM dbo.onboarding_stages 
        WHERE client_id = @clientId 
        ORDER BY order_number ASC;
      `);

    const stages = stagesResult.recordset;

    // Fetch tasks for each stage
    const tasksResult = await pool.request()
      .input("clientId", sql.Int, clientId)
      .query(`
        SELECT * 
        FROM dbo.onboarding_tasks
        WHERE client_id = @clientId
        ORDER BY order_number ASC;
      `);

    const tasks = tasksResult.recordset;

    // Group tasks under their stages
    const stagesWithTasks = stages.map(stage => ({
      ...stage,
      tasks: tasks.filter(t => t.stage_id === stage.stage_id)
    }));

    return NextResponse.json({ success: true, data: stagesWithTasks });

  } catch (err) {
    console.error("GET /api/stages/get error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stages" },
      { status: 500 }
    );
  }
}
