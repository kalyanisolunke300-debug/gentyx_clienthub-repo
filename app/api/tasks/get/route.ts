// app/api/tasks/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
 
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
 
    const q = searchParams.get("q");
    const taskType = searchParams.get("taskType"); // ONBOARDING | ASSIGNED
    const assignedRole = searchParams.get("assignedRole"); // CLIENT | CPA | SERVICE_CENTER | ADMIN
    const dueFrom = searchParams.get("dueFrom");
    const dueTo = searchParams.get("dueTo");
 
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20);
    const offset = (page - 1) * pageSize;
 
    const pool = await getDbPool();
 
    const result = await pool.request()
      .input("q", sql.NVarChar, q || null)
      .input("taskType", sql.VarChar, taskType || null)
      .input("assignedRole", sql.VarChar, assignedRole || null)
      .input("dueFrom", sql.Date, dueFrom || null)
      .input("dueTo", sql.Date, dueTo || null)
      .input("offset", sql.Int, offset)
      .input("pageSize", sql.Int, pageSize)
      .query(`
        SELECT *
        FROM (
          -- 🔹 ONBOARDING TASKS (Stage Subtasks)
          SELECT
            css.subtask_id    AS id,
            cs.client_id      AS clientId,
            ISNULL(c.client_name, 'Unknown Client') AS clientName,
            css.subtask_title AS title,
            'ONBOARDING'      AS taskType,
            'CLIENT'          AS assignedRole,
            css.status        AS status,
            css.due_date      AS dueDate,
            s.stage_name      AS sourceStage,
            css.created_at    AS createdAt
          FROM dbo.client_stage_subtasks css
          LEFT JOIN dbo.client_stages cs
            ON cs.client_stage_id = css.client_stage_id
          LEFT JOIN dbo.clients c
            ON c.client_id = cs.client_id
          LEFT JOIN dbo.onboarding_stages s
            ON s.stage_id = cs.stage_id
 
          UNION ALL
 
          -- 🔹 ASSIGNED TASKS (Manual)
          SELECT
            t.task_id                AS id,
            t.client_id              AS clientId,
            c.client_name            AS clientName,
            t.task_title             AS title,
            'ASSIGNED'               AS taskType,
            t.assigned_to_role       AS assignedRole,
            t.status                 AS status,
            t.due_date               AS dueDate,
            NULL                     AS sourceStage,
            t.created_at             AS createdAt
          FROM dbo.onboarding_tasks t
          JOIN dbo.clients c
            ON c.client_id = t.client_id
        ) x
        WHERE
          (@taskType IS NULL OR x.taskType = @taskType)
          AND (@assignedRole IS NULL OR x.assignedRole = @assignedRole)
          AND (@dueFrom IS NULL OR x.dueDate >= @dueFrom)
          AND (@dueTo IS NULL OR x.dueDate <= @dueTo)
          AND (
            @q IS NULL OR
            x.title LIKE '%' + @q + '%' OR
            x.clientName LIKE '%' + @q + '%'
          )
        ORDER BY x.dueDate ASC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);
 
    return NextResponse.json({
      success: true,
      data: result.recordset,
      page,
      pageSize
    });
 
  } catch (err: any) {
    console.error("GET /api/tasks/get error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}