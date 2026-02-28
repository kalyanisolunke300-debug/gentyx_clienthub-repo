// app/api/stages/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = Number(searchParams.get("clientId"));
    if (!clientId) return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 });

    const pool = await getDbPool();

    const stagesResult = await pool.query(`
      SELECT client_stage_id, client_id, stage_name, order_number, status, is_required, completed_at, created_at, updated_at
      FROM public."client_stages" WHERE client_id = $1 ORDER BY order_number ASC
    `, [clientId]);

    const tasksResult = await pool.query(`
      SELECT * FROM public."onboarding_tasks" WHERE client_id = $1 ORDER BY order_number ASC
    `, [clientId]);

    const stagesWithTasks = stagesResult.rows.map((stage: any) => ({
      ...stage,
      tasks: tasksResult.rows.filter((t: any) => t.stage_id === stage.client_stage_id),
    }));

    return NextResponse.json({ success: true, data: stagesWithTasks });
  } catch (err) {
    console.error("GET /api/stages/get error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch stages" }, { status: 500 });
  }
}
