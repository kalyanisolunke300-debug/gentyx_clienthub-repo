// /app/api/stages/client/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ success: false, error: "Client ID required" }, { status: 400 });

    const pool = await getDbPool();

    const stages = await pool.query(`
      SELECT client_stage_id, stage_name, order_number, is_required, status, start_date, completed_at,
        COALESCE(document_required, false) as document_required,
        COALESCE(document_mode, 'stage') as document_mode
      FROM public."client_stages" WHERE client_id = $1 ORDER BY order_number
    `, [Number(clientId)]);

    const subtasks = await pool.query(`
      SELECT s.client_stage_id, t.subtask_id, t.subtask_title, t.status, t.order_number,
        t.due_date, COALESCE(t.document_required, false) as document_required, t.created_at
      FROM public."client_stages" s
      LEFT JOIN public."client_stage_subtasks" t ON s.client_stage_id = t.client_stage_id
      WHERE s.client_id = $1
      ORDER BY s.order_number, t.order_number
    `, [Number(clientId)]);

    return NextResponse.json({ success: true, data: stages.rows, subtasks: subtasks.rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
