// app/api/tasks/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { calculateClientProgress } from "@/lib/progress";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, taskTitle, dueDate, status, assignedToRole } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // -----------------------------------------------------
    // 1️⃣ Fetch clientId using taskId
    // -----------------------------------------------------
    const clientResult = await pool.request()
      .input("taskId", sql.Int, taskId)
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
    // 2️⃣ Update the task
    // -----------------------------------------------------
    await pool.request()
      .input("taskId", sql.Int, taskId)
      .input("taskTitle", sql.VarChar(255), taskTitle)
      .input("dueDate", sql.DateTime, dueDate || null)
      .input("status", sql.VarChar(50), status)
      .input("assignedToRole", sql.VarChar(50), assignedToRole)
      .query(`
        UPDATE dbo.onboarding_tasks
        SET
          task_title = COALESCE(@taskTitle, task_title),
          due_date = COALESCE(@dueDate, due_date),
          status = COALESCE(@status, status),
          assigned_to_role = COALESCE(@assignedToRole, assigned_to_role),
          updated_at = GETDATE()
        WHERE task_id = @taskId;
      `);

    // -----------------------------------------------------
    // 3️⃣ Recalculate the client's progress (MAIN LOGIC)
    // -----------------------------------------------------
    await calculateClientProgress(clientId);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("POST /api/tasks/update error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update task" },
      { status: 500 }
    );
  }
}
