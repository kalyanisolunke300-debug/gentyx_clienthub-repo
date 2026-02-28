// app/api/stages/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, stageName } = body;
    if (!clientId || !stageName) return NextResponse.json({ success: false, error: "clientId and stageName are required" }, { status: 400 });

    const pool = await getDbPool();

    await pool.query(`UPDATE public."onboarding_stages" SET status = 'Not Started' WHERE client_id = $1`, [clientId]);
    await pool.query(`UPDATE public."onboarding_stages" SET status = 'In Progress' WHERE client_id = $1 AND stage_name = $2`, [clientId, stageName]);

    logAudit({ clientId, action: AuditActions.STAGE_STARTED, actorRole: "ADMIN", details: stageName });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/stages/update error:", err);
    return NextResponse.json({ success: false, error: "Failed to update stage" }, { status: 500 });
  }
}
