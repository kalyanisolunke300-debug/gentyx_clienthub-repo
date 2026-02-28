// app/api/stages/client/save/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { calculateClientProgress } from "@/lib/progress";
import { logAudit, AuditActions } from "@/lib/audit";
import { sendOnboardingOverviewEmail } from "@/lib/email";

function computeFinalStageStatus(subtasks: any[]) {
  if (!subtasks || subtasks.length === 0) return "Not Started";
  const allCompleted = subtasks.every((t) => (t.status || "").toLowerCase() === "completed");
  if (allCompleted) return "Completed";
  return "In Progress";
}

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

    const body = await req.json();
    const clientId = body.clientId;
    const sendEmailNotification = body.sendEmailNotification !== false;

    const stages = Array.isArray(body.stages)
      ? [...body.stages].sort((a, b) => (a.order || 0) - (b.order || 0))
      : [];

    if (!clientId) {
      return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 });
    }

    const pool = await getDbPool();

    // Fetch client details
    const clientResult = await pool.query(`
      SELECT c.client_id, c.client_name, c.primary_contact_name, c.primary_contact_email
      FROM public."Clients" c WHERE c.client_id = $1
    `, [clientId]);

    const clientData = clientResult.rows[0];

    // Use pg transaction
    const pgClient = await pool.connect();

    try {
      await pgClient.query('BEGIN');

      // Step 1: Delete old stages + subtasks
      await pgClient.query(`
        DELETE FROM public."client_stage_subtasks" 
        WHERE client_stage_id IN (
          SELECT client_stage_id FROM public."client_stages" WHERE client_id = $1
        )
      `, [clientId]);

      await pgClient.query(`DELETE FROM public."client_stages" WHERE client_id = $1`, [clientId]);

      let prevCompletionDate: string | null = null;

      // Step 2: Insert new stages & subtasks
      for (const stage of stages) {
        const finalStatus = computeFinalStageStatus(stage.subtasks || []);
        const completedAt = finalStatus === "Completed" ? toISODate(stage.completed_at) || todayISO() : null;
        const startDateFromPayload = toISODate(stage.start_date);
        const startDate = startDateFromPayload
          || (prevCompletionDate ? prevCompletionDate : null)
          || ((finalStatus === "In Progress" || finalStatus === "Completed") ? todayISO() : null);

        const stageInsert = await pgClient.query(`
          INSERT INTO public."client_stages"
            (client_id, stage_name, order_number, is_required, status, start_date, completed_at, document_required, document_mode, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING client_stage_id
        `, [
          clientId, stage.name, stage.order, stage.isRequired ? true : false,
          finalStatus, startDate, completedAt,
          stage.document_required ? true : false,
          stage.document_mode || 'stage'
        ]);

        const stageId = stageInsert.rows[0].client_stage_id;
        console.log("Inserted Stage ID:", stageId);

        prevCompletionDate = completedAt;

        if (finalStatus === "Completed") {
          logAudit({ clientId, action: AuditActions.STAGE_COMPLETED, actorRole: "ADMIN", details: stage.name });
        }

        // Insert subtasks
        if (stage.subtasks && stage.subtasks.length > 0) {
          for (let i = 0; i < stage.subtasks.length; i++) {
            const sub = stage.subtasks[i];
            const safeTitle = (sub.title || "").trim();
            console.log("Subtask Insert:", safeTitle);

            await pgClient.query(`
              INSERT INTO public."client_stage_subtasks"
                (client_stage_id, subtask_title, status, order_number, due_date, document_required, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [stageId, safeTitle, sub.status || "Not Started", i + 1, sub.due_date || null, sub.document_required ? true : false]);
          }
        }
      }

      await pgClient.query('COMMIT');
      console.log("Stages + Subtasks saved successfully.");

      // Recalculate progress
      try { await calculateClientProgress(clientId); } catch (e) { console.error("Failed to recalculate progress:", e); }

      // Send email
      if (sendEmailNotification && clientData?.primary_contact_email && stages.length > 0) {
        try {
          const formattedStages = stages.map((stage: any) => ({
            name: stage.name,
            status: computeFinalStageStatus(stage.subtasks || []),
            subtasks: (stage.subtasks || []).map((sub: any) => ({
              title: sub.title, status: sub.status || 'Not Started', due_date: sub.due_date,
            }))
          }));

          await sendOnboardingOverviewEmail({
            recipientEmail: clientData.primary_contact_email,
            recipientName: clientData.primary_contact_name || clientData.client_name,
            clientName: clientData.client_name,
            stages: formattedStages,
          });
        } catch (emailError) {
          console.error("❌ Onboarding overview email error:", emailError);
        }
      }

      return NextResponse.json({ success: true });
    } catch (innerErr) {
      await pgClient.query('ROLLBACK');
      console.error("Transaction rolled back:", innerErr);
      throw innerErr;
    } finally {
      pgClient.release();
    }
  } catch (err: any) {
    console.error("SAVE STAGE ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
