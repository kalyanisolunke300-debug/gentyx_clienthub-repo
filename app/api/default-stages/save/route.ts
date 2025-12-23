// app/api/default-stages/save/route.ts

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { templateId, stages } = await req.json();

    if (!templateId || !Array.isArray(stages)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();
    const transaction = pool.transaction();

    await transaction.begin();

    // 1. Delete old subtasks and stages
    await transaction
      .request()
      .input("templateId", templateId)
      .query(`
        DELETE FROM dbo.default_stage_subtasks 
        WHERE default_stage_id IN (SELECT default_stage_id FROM dbo.default_stages WHERE template_id = @templateId);

        DELETE FROM dbo.default_stages WHERE template_id = @templateId;
      `);

    // 2. Insert new data
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];

      const stageRes = await transaction
        .request()
        .input("templateId", templateId)
        .input("stage_name", s.stage_name)
        .input("order_number", i + 1)
        .input("is_required", s.is_required ?? false)
        .query(`
          INSERT INTO dbo.default_stages
          (template_id, stage_name, order_number, is_required)
          OUTPUT INSERTED.default_stage_id
          VALUES (@templateId, @stage_name, @order_number, @is_required)
        `);

      const newStageId = stageRes.recordset[0].default_stage_id;

      if (s.subtasks && Array.isArray(s.subtasks)) {
        for (let j = 0; j < s.subtasks.length; j++) {
          const st = s.subtasks[j];
          await transaction
            .request()
            .input("sid", newStageId)
            .input("title", st.title || "")
            .input("order", j + 1)
            .query(`
              INSERT INTO dbo.default_stage_subtasks 
              (default_stage_id, title, order_number, status) 
              VALUES (@sid, @title, @order, 'Not Started')
            `);
        }
      }
    }

    await transaction.commit();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
