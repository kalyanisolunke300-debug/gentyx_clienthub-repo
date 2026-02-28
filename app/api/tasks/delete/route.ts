//app/api/tasks/delete/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { calculateClientProgress } from "@/lib/progress";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { task_id } = body;

    if (!task_id) {
      return NextResponse.json({ success: false, error: "task_id is required" }, { status: 400 });
    }

    const pool = await getDbPool();

    const clientResult = await pool.query(
      `SELECT client_id FROM public."onboarding_tasks" WHERE task_id = $1`,
      [task_id]
    );
    const clientId = clientResult.rows[0]?.client_id;

    if (!clientId) {
      return NextResponse.json({ success: false, error: "Client not found for this task" }, { status: 404 });
    }

    await pool.query(`DELETE FROM public."onboarding_tasks" WHERE task_id = $1`, [task_id]);

    try { if (clientId) await calculateClientProgress(clientId); } catch (e) { console.error("Progress calculation failed after delete:", e); }
    try { logAudit({ clientId: clientId || 0, action: AuditActions.TASK_DELETED, actorRole: "ADMIN", details: `Task #${task_id}` }); } catch (e) { console.error("Audit log failed:", e); }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/tasks/delete error:", err);
    return NextResponse.json({ success: false, error: "Failed to delete task" }, { status: 500 });
  }
}
