// app/api/tasks/add/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("🔍 Incoming /api/tasks/add body:", body);

    const {
      stageId: rawStageId,
      clientId: rawClientId,
      taskTitle: rawTaskTitle,
      title,
      description = "",
      dueDate,
      assignedToRole,
      assigneeRole,
      orderNumber: rawOrderNumber,
    } = body;

    // fallback values
    const stageId = Number(rawStageId ?? 1);
    const clientId = rawClientId != null ? Number(rawClientId) : undefined;
    const taskTitle = rawTaskTitle || title;
    const role = assignedToRole || assigneeRole || "CLIENT";
    const orderNumber = Number(rawOrderNumber ?? 1);

    if (!clientId || !taskTitle) {
      return NextResponse.json(
        { success: false, error: "clientId and taskTitle are required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("stageId", sql.Int, stageId)         // ✅ FIXED
      .input("clientId", sql.Int, clientId)
      .input("taskTitle", sql.VarChar(255), taskTitle)
      .input("description", sql.VarChar(sql.MAX), description)
      .input("dueDate", sql.DateTime, dueDate || null)
      .input("assignedToRole", sql.VarChar(50), role)
      .input("orderNumber", sql.Int, orderNumber)
      .query(`
        INSERT INTO dbo.onboarding_tasks
        (stage_id, client_id, task_title, description, assigned_to_role, due_date, status, order_number, created_at, updated_at)
        OUTPUT inserted.task_id
        VALUES (@stageId, @clientId, @taskTitle, @description, @assignedToRole, @dueDate, 'Pending', @orderNumber, GETDATE(), GETDATE());
      `);

    const insertedId = result.recordset[0].task_id;

    return NextResponse.json({
      success: true,
      taskId: insertedId,
    });

  } catch (err: any) {
    console.error("POST /api/tasks/add error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
