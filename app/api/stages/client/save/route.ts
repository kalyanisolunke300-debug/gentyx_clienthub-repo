// app/api/stages/client/save/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { calculateClientProgress } from "@/lib/progress";
import { logAudit, AuditActions } from "@/lib/audit";

// Server-side stage status calculation
function computeFinalStageStatus(subtasks: any[]) {
  if (!subtasks || subtasks.length === 0) return "Not Started";

  const allCompleted = subtasks.every(
    (t) => (t.status || "").toLowerCase() === "completed"
  );

  if (allCompleted) return "Completed";

  return "In Progress";
}

// Helpers for safe DATE handling
function toISODate(d: any): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    console.log("STAGE SAVE API CALLED");

    // ✅ Read body safely
    const body = await req.json();
    const clientId = body.clientId;

    // ✅ Always process stages in order (for cascade logic)
    const stages = Array.isArray(body.stages)
      ? [...body.stages].sort((a, b) => (a.order || 0) - (b.order || 0))
      : [];

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Step 1: Delete old stages + subtasks
      await transaction
        .request()
        .input("clientId", sql.Int, clientId)
        .query(`
          DELETE FROM dbo.client_stage_subtasks 
          WHERE client_stage_id IN (
            SELECT client_stage_id FROM dbo.client_stages WHERE client_id = @clientId
          );

          DELETE FROM dbo.client_stages WHERE client_id = @clientId;
        `);

      // Used to cascade next stage start_date
      let prevCompletionDate: string | null = null;

      // Step 2: Insert new stages & subtasks
      for (const stage of stages) {
        // Auto-calculate final status (server authority)
        const finalStatus = computeFinalStageStatus(stage.subtasks || []);

        // completed_at logic
        const completedAt =
          finalStatus === "Completed"
            ? toISODate(stage.completed_at) || todayISO()
            : null;

        // start_date logic (manual first, else cascade)
        const startDateFromPayload = toISODate(stage.start_date);

        const startDate =
          startDateFromPayload ||
          (prevCompletionDate ? prevCompletionDate : null) ||
          (finalStatus === "In Progress" || finalStatus === "Completed"
            ? todayISO()
            : null);

        // Insert STAGE including start_date + completed_at
        const stageInsert = await transaction
          .request()
          .input("clientId", sql.Int, clientId)
          .input("stageName", sql.NVarChar, stage.name)
          .input("orderNum", sql.Int, stage.order)
          .input("isRequired", sql.Bit, stage.isRequired ? 1 : 0)
          .input("status", sql.NVarChar, finalStatus)
          .input("startDate", sql.Date, startDate)
          .input("completedAt", sql.Date, completedAt)
          .query(`
            INSERT INTO dbo.client_stages
              (client_id, stage_name, order_number, is_required, status, start_date, completed_at, created_at)
            OUTPUT INSERTED.client_stage_id
            VALUES
              (@clientId, @stageName, @orderNum, @isRequired, @status, @startDate, @completedAt, GETDATE());
          `);

        const stageId = stageInsert.recordset[0].client_stage_id;
        console.log("Inserted Stage ID:", stageId);

        // Cascade setup for next stage
        prevCompletionDate = completedAt;

        // Audit log for stage completion
        if (finalStatus === "Completed") {
          logAudit({
            clientId,
            action: AuditActions.STAGE_COMPLETED,
            actorRole: "ADMIN",
            details: stage.name,
          });
        }

        // Insert subtasks
        if (stage.subtasks && stage.subtasks.length > 0) {
          for (let i = 0; i < stage.subtasks.length; i++) {
            const sub = stage.subtasks[i];

            // Prevent null title from crashing
            const safeTitle = (sub.title || "").trim();
            console.log("Subtask Insert:", safeTitle);

            await transaction
              .request()
              .input("stageId", sql.Int, stageId)
              .input("title", sql.NVarChar, safeTitle)
              .input("status", sql.NVarChar, sub.status || "Not Started")
              .input("orderNum", sql.Int, i + 1)
              .input("dueDate", sql.Date, sub.due_date || null)
              .query(`
                INSERT INTO dbo.client_stage_subtasks
                  (client_stage_id, subtask_title, status, order_number, due_date, created_at)
                VALUES
                  (@stageId, @title, @status, @orderNum, @dueDate, GETDATE());
              `);
          }
        }
      }

      // Step 3: Commit transaction
      await transaction.commit();

      console.log("Stages + Subtasks saved successfully.");

      // Step 4: Recalculate Client Progress
      try {
        await calculateClientProgress(clientId);
        console.log("Client Progress Recalculated");
      } catch (progErr) {
        console.error("Failed to recalculate progress:", progErr);
        // Don't fail the request, just log it
      }

      return NextResponse.json({ success: true });
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
