// app/api/tasks/list/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const pool = await getDbPool();

    let query = `
      SELECT t.task_id AS id, t.stage_id AS "stageId", t.client_id AS "clientId",
        c.client_name AS "clientName", t.task_title AS title, t.assigned_to_role AS "assigneeRole",
        t.status, t.due_date AS "dueDate", t.created_at, t.document_required AS "documentRequired"
      FROM public."onboarding_tasks" t
      LEFT JOIN public."Clients" c ON t.client_id = c.client_id
    `;

    const params: any[] = [];
    if (clientId) {
      query += ` WHERE t.client_id = $1`;
      params.push(Number(clientId));
    }
    query += ` ORDER BY t.created_at DESC`;

    const result = await pool.query(query, params);

    return NextResponse.json({ success: true, data: result.rows, total: result.rows.length, page: 1, pageSize: result.rows.length });
  } catch (err: any) {
    console.error("GET /api/tasks/list error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
