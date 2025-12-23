// app/api/stages/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, stageName } = body;

    if (!clientId || !stageName) {
      return NextResponse.json(
        { success: false, error: "clientId and stageName are required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 1️⃣ Reset all stages to Not Started
    await pool.request()
      .input("clientId", sql.Int, clientId)
      .query(`
        UPDATE onboarding_stages
        SET status = 'Not Started'
        WHERE client_id = @clientId
      `);

    // 2️⃣ Set the selected stage to In Progress
    await pool.request()
      .input("clientId", sql.Int, clientId)
      .input("stageName", sql.VarChar(255), stageName)
      .query(`
        UPDATE onboarding_stages
        SET status = 'In Progress'
        WHERE client_id = @clientId
        AND stage_name = @stageName
      `);

    // Audit log
    logAudit({
      clientId,
      action: AuditActions.STAGE_STARTED,
      actorRole: "ADMIN",
      details: stageName,
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("POST /api/stages/update error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update stage" },
      { status: 500 }
    );
  }
}
