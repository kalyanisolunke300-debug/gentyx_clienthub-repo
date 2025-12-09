//app/api/tasks/delete/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { calculateClientProgress } from "@/lib/progress";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { task_id } = body;

    if (!task_id) {
      return NextResponse.json(
        { success: false, error: "task_id is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // -----------------------------------------------------
    // 1️⃣ Fetch clientId using task_id (before delete)
    // -----------------------------------------------------
    const clientResult = await pool
      .request()
      .input("taskId", sql.Int, task_id)
      .query(`
        SELECT client_id
        FROM dbo.onboarding_tasks
        WHERE task_id = @taskId;
      `);

    const clientId = clientResult.recordset[0]?.client_id;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client not found for this task" },
        { status: 404 }
      );
    }

    // -----------------------------------------------------
    // 2️⃣ DELETE the task
    // -----------------------------------------------------
    await pool
      .request()
      .input("taskId", sql.Int, task_id)
      .query(`
        DELETE FROM dbo.onboarding_tasks
        WHERE task_id = @taskId;
      `);

    // -----------------------------------------------------
    // 3️⃣ Recalculate client progress
    // -----------------------------------------------------
    await calculateClientProgress(clientId);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("POST /api/tasks/delete error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
