import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, stageName, isRequired, orderNumber } = body;
    if (!clientId || !stageName) return NextResponse.json({ success: false, error: "clientId and stageName are required" }, { status: 400 });

    const pool = await getDbPool();
    await pool.query(`
      INSERT INTO public."onboarding_stages" (client_id, stage_name, is_required, order_number, status, created_at)
      VALUES ($1, $2, $3, $4, 'Pending', NOW())
    `, [clientId, stageName, isRequired ?? true, orderNumber ?? 1]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/stages/add error:", err);
    return NextResponse.json({ success: false, error: "Failed to add stage" }, { status: 500 });
  }
}
