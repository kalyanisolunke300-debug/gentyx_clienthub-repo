// app/api/tasks/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { calculateClientProgress } from "@/lib/progress";
import { logAudit, AuditActions } from "@/lib/audit";

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

    // Note: clientId could be 0 or null in some edge cases
    // We'll proceed with update even if clientId is not found
    // but skip progress calculation

    // -----------------------------------------------------
    // 2️⃣ Update the task
    // -----------------------------------------------------
    const updateResult = await pool.request()
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

    // Check if any row was updated
    if (updateResult.rowsAffected[0] === 0) {
      return NextResponse.json(
        { success: false, error: "Task not found or no changes made" },
        { status: 404 }
      );
    }

    // -----------------------------------------------------
    // 3️⃣ Recalculate the client's progress (MAIN LOGIC)
    // -----------------------------------------------------
    if (clientId) {
      try {
        await calculateClientProgress(clientId);
      } catch (progressError) {
        console.error("Progress calculation failed:", progressError);
        // Don't fail the entire request - task was already updated
      }

      // Audit log
      try {
        const isCompleted = status === "Completed";
        logAudit({
          clientId,
          action: isCompleted ? AuditActions.TASK_COMPLETED : AuditActions.TASK_UPDATED,
          actorRole: "CLIENT",
          details: taskTitle || `Task #${taskId}`,
        });
      } catch (auditError) {
        console.error("Audit log failed:", auditError);
        // Don't fail the entire request
      }
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("POST /api/tasks/update error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update task" },
      { status: 500 }
    );
  }
}
