// app/api/stages/client/save/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    console.log("STAGE SAVE API CALLED");

    const { clientId, stages } = await req.json();
    const pool = await getDbPool();

    // Start fresh transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 🔹 Delete existing records for client
      await transaction.request()
        .input("clientId", sql.Int, clientId)
        .query(`
          DELETE FROM dbo.client_stage_subtasks 
          WHERE client_stage_id IN (SELECT client_stage_id FROM dbo.client_stages WHERE client_id = @clientId);

          DELETE FROM dbo.client_stages WHERE client_id = @clientId;
        `);

      // 🔹 Reinsert stages & subtasks
      for (const stage of stages) {
        const stageInsert = await transaction.request()
          .input("clientId", sql.Int, clientId)
          .input("stageName", sql.NVarChar, stage.name)
          .input("orderNum", sql.Int, stage.order)
          .input("isRequired", sql.Bit, stage.isRequired ? 1 : 0)
          .input("status", sql.NVarChar, stage.status || "Not Started")
          .query(`
            INSERT INTO dbo.client_stages (client_id, stage_name, order_number, is_required, status, created_at)
            OUTPUT INSERTED.client_stage_id
            VALUES (@clientId, @stageName, @orderNum, @isRequired, @status, GETDATE());
          `);

        const stageId = stageInsert.recordset[0].client_stage_id;

        // ✅ Insert subtasks if present
        if (Array.isArray(stage.subtasks)) {
          for (let i = 0; i < stage.subtasks.length; i++) {
            const sub = stage.subtasks[i];
            if (!sub || !sub.title?.trim()) continue;

            await transaction.request()
              .input("stageId", sql.Int, stageId)
              .input("title", sql.NVarChar, sub.title.trim())
              .input("orderNum", sql.Int, i + 1)
              .input("status", sql.NVarChar, sub.status || "Not Started")
              .query(`
                INSERT INTO dbo.client_stage_subtasks (client_stage_id, subtask_title, order_number, status, created_at)
                VALUES (@stageId, @title, @orderNum, @status, GETDATE());
              `);
          }
        }
      }

      await transaction.commit();
      console.log("✅ Stages + subtasks saved successfully.");
      return NextResponse.json({ success: true, message: "Stages saved successfully" });

    } catch (innerErr) {
      await transaction.rollback();
      console.error("Transaction rolled back:", innerErr);
      throw innerErr;
    }

  } catch (err: any) {
    console.error("SAVE STAGE ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
