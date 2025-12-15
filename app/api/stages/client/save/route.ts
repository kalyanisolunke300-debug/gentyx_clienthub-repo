// app/api/stages/client/save/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

// ✅ SERVER-SIDE FINAL STAGE STATUS AUTHORITY
function computeFinalStageStatus(subtasks: any[]) {
  if (!subtasks || subtasks.length === 0) return "Not Started";

  const allCompleted = subtasks.every(
    (t) => (t.status || "").toLowerCase() === "completed"
  );

  if (allCompleted) return "Completed";

  return "In Progress";
}


export async function POST(req: Request) {
  try {
    console.log("STAGE SAVE API CALLED");

    const { clientId, stages } = await req.json();
    const pool = await getDbPool();

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 🔥 1️⃣ Delete old stages + subtasks
      await transaction.request()
        .input("clientId", sql.Int, clientId)
        .query(`
          DELETE FROM dbo.client_stage_subtasks 
          WHERE client_stage_id IN (
            SELECT client_stage_id FROM dbo.client_stages WHERE client_id = @clientId
          );

          DELETE FROM dbo.client_stages WHERE client_id = @clientId;
        `);

      // 🔥 2️⃣ Insert new stages & subtasks
      for (const stage of stages) {
            // ✅ ✅ AUTO-CALCULATE FINAL STATUS (DO NOT TRUST FRONTEND)
            const finalStatus = computeFinalStageStatus(stage.subtasks || []);

            // Insert STAGE
            const stageInsert = await transaction.request()
              .input("clientId", sql.Int, clientId)
              .input("stageName", sql.NVarChar, stage.name)
              .input("orderNum", sql.Int, stage.order)
              .input("isRequired", sql.Bit, stage.isRequired ? 1 : 0)
              .input("status", sql.NVarChar, finalStatus)   // ✅ SERVER AUTHORITY
              .query(`
                INSERT INTO dbo.client_stages
                (client_id, stage_name, order_number, is_required, status, created_at)
                OUTPUT INSERTED.client_stage_id
                VALUES (@clientId, @stageName, @orderNum, @isRequired, @status, GETDATE());
              `);


        const stageId = stageInsert.recordset[0].client_stage_id;
        console.log("🟩 Inserted Stage ID:", stageId);

        // Insert SUBTASKS
        if (stage.subtasks && stage.subtasks.length > 0) {
          for (let i = 0; i < stage.subtasks.length; i++) {
            const sub = stage.subtasks[i];

            // Prevent null title from crashing
            const safeTitle = (sub.title || "").trim();

            console.log("➡️ Subtask Insert:", safeTitle);

            await transaction.request()
              .input("stageId", sql.Int, stageId)
              .input("title", sql.NVarChar, safeTitle)
              .input("status", sql.NVarChar, sub.status || "Not Started")
              .input("orderNum", sql.Int, i + 1)
              .input("dueDate", sql.Date, sub.due_date || null)   // <-- ⭐ NEW FIELD
              .query(`
                INSERT INTO dbo.client_stage_subtasks
                (client_stage_id, subtask_title, status, order_number, due_date, created_at)
                VALUES (@stageId, @title, @status, @orderNum, @dueDate, GETDATE());
              `);

          }
        }
      }

      // 🔥 3️⃣ Commit transaction
      await transaction.commit();

      console.log("✅ Stages + Subtasks saved successfully.");
      return NextResponse.json({ success: true });

    } catch (innerErr) {
      await transaction.rollback();
      console.error("❌ Transaction rolled back:", innerErr);
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
