// app/api/default-stages/list/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("templateId");

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: "templateId required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("templateId", Number(templateId))
      .query(`
        SELECT *
        FROM dbo.default_stages
        WHERE template_id = @templateId
        ORDER BY order_number
      `);

    const stages = result.recordset;

    // Fetch subtasks if there are stages
    let subtasks: any[] = [];
    if (stages.length > 0) {
      const stageIds = stages.map((s: any) => s.default_stage_id);
      const subRes = await pool.query(`
        SELECT * 
        FROM dbo.default_stage_subtasks
        WHERE default_stage_id IN (${stageIds.join(",")})
        ORDER BY order_number
      `);
      subtasks = subRes.recordset;
    }

    // Merge subtasks into stages
    const data = stages.map((s: any) => ({
      ...s,
      subtasks: subtasks.filter((st: any) => st.default_stage_id === s.default_stage_id),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
