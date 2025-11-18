// app/api/tasks/add/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      stageId = 1,
      clientId,
      taskTitle,
      dueDate,
      assignedToRole = "CLIENT",
      orderNumber = 1,
    } = body;

    if (!clientId || !taskTitle) {
      return NextResponse.json(
        {
          success: false,
          error: "clientId and taskTitle are required",
        },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    await pool
      .request()
      .input("stageId", sql.Int, stageId)
      .input("clientId", sql.Int, clientId)
      .input("taskTitle", sql.VarChar(255), taskTitle)
      .input("dueDate", sql.DateTime, dueDate || null)
      .input("assignedToRole", sql.VarChar(50), assignedToRole)
      .input("orderNumber", sql.Int, orderNumber)
      .query(`
        INSERT INTO dbo.onboarding_tasks
        (stage_id, client_id, task_title, due_date, assigned_to_role, status, order_number, created_at)
        VALUES (@stageId, @clientId, @taskTitle, @dueDate, @assignedToRole, 'Pending', @orderNumber, GETDATE());
      `);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/tasks/add error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
