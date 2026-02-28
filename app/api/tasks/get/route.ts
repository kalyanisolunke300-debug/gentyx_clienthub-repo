// app/api/tasks/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q");
    const taskType = searchParams.get("taskType");
    const assignedRole = searchParams.get("assignedRole");
    const dueFrom = searchParams.get("dueFrom");
    const dueTo = searchParams.get("dueTo");
    const clientId = searchParams.get("clientId");
    const taskId = searchParams.get("taskId");

    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20);
    const offset = (page - 1) * pageSize;

    const pool = await getDbPool();

    const result = await pool.query(`
        SELECT *
        FROM (
          -- 🔹 ONBOARDING TASKS (Stage Subtasks)
          SELECT
            css.subtask_id    AS id,
            cs.client_id      AS "clientId",
            COALESCE(c.client_name, 'Unknown Client') AS "clientName",
            css.subtask_title AS title,
            'ONBOARDING'      AS "taskType",
            'CLIENT'          AS "assignedRole",
            css.status        AS status,
            css.due_date      AS "dueDate",
            s.stage_name      AS "sourceStage",
            css.created_at    AS "createdAt",
            COALESCE(css.document_required, false) AS "documentRequired"
          FROM public."client_stage_subtasks" css
          LEFT JOIN public."client_stages" cs
            ON cs.client_stage_id = css.client_stage_id
          LEFT JOIN public."Clients" c
            ON c.client_id = cs.client_id
          LEFT JOIN public."onboarding_stages" s
            ON s.stage_id = cs.stage_id

          UNION ALL

          -- 🔹 ASSIGNED TASKS (Manual)
          SELECT
            t.task_id                AS id,
            t.client_id              AS "clientId",
            c.client_name            AS "clientName",
            t.task_title             AS title,
            'ASSIGNED'               AS "taskType",
            t.assigned_to_role       AS "assignedRole",
            t.status                 AS status,
            t.due_date               AS "dueDate",
            NULL                     AS "sourceStage",
            t.created_at             AS "createdAt",
            COALESCE(t.document_required, true) AS "documentRequired"
          FROM public."onboarding_tasks" t
          JOIN public."Clients" c
            ON c.client_id = t.client_id
        ) x
        WHERE
          ($1::text IS NULL OR x."taskType" = $1)
          AND ($2::text IS NULL OR x."assignedRole" = $2)
          AND ($3::date IS NULL OR x."dueDate" >= $3::date)
          AND ($4::date IS NULL OR x."dueDate" <= $4::date)
          AND ($5::int IS NULL OR x."clientId" = $5)
          AND ($6::int IS NULL OR x.id = $6)
          AND (
            $7::text IS NULL OR
            x.title ILIKE '%' || $7 || '%' OR
            x."clientName" ILIKE '%' || $7 || '%'
          )
        ORDER BY x."createdAt" DESC
        OFFSET $8 LIMIT $9
      `, [
      taskType || null,
      assignedRole || null,
      dueFrom || null,
      dueTo || null,
      clientId ? Number(clientId) : null,
      taskId ? Number(taskId) : null,
      q || null,
      offset,
      pageSize
    ]);

    return NextResponse.json({ success: true, data: result.rows, page, pageSize });
  } catch (err: any) {
    console.error("GET /api/tasks/get error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch tasks" }, { status: 500 });
  }
}