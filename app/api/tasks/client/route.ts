// app/api/tasks/client/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 });
    }

    const pool = await getDbPool();

    const result = await pool.query(`
        SELECT task_id, task_title, assigned_to_role, due_date, status
        FROM public."onboarding_tasks"
        WHERE client_id = $1
        ORDER BY task_id DESC
      `, [Number(clientId)]);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
