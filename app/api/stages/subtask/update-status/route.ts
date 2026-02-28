// app/api/stages/subtask/update-status/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { sendAdminTaskCompletionEmail, getAdminsWithNotificationsEnabled } from "@/lib/email";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { subtaskId, status, completedByRole, completedByName } = body;

        if (!subtaskId) return NextResponse.json({ success: false, error: "Missing subtaskId" }, { status: 400 });
        if (!status) return NextResponse.json({ success: false, error: "Missing status" }, { status: 400 });

        const pool = await getDbPool();

        // Fetch subtask details BEFORE update
        const subtaskResult = await pool.query(`
            SELECT s.subtask_id, s.subtask_title, s.status as previous_status, cs.stage_name, cs.client_id,
              c.client_name, c.primary_contact_name, c.cpa_id, c.service_center_id,
              cp.cpa_name, sc.center_name as service_center_name
            FROM public."client_stage_subtasks" s
            JOIN public."client_stages" cs ON cs.client_stage_id = s.client_stage_id
            LEFT JOIN public."Clients" c ON c.client_id = cs.client_id
            LEFT JOIN public."cpa_centers" cp ON cp.cpa_id = c.cpa_id
            LEFT JOIN public."service_centers" sc ON sc.service_center_id = c.service_center_id
            WHERE s.subtask_id = $1
          `, [subtaskId]);

        const subtaskData = subtaskResult.rows[0];
        const previousStatus = subtaskData?.previous_status;

        // Update subtask status
        await pool.query(`
        UPDATE public."client_stage_subtasks"
        SET status = $1, updated_at = NOW()
        WHERE subtask_id = $2
      `, [status, subtaskId]);

        // Admin notification on completion
        const isNewlyCompleted = status === "Completed" && previousStatus !== "Completed";
        if (isNewlyCompleted && subtaskData) {
            try {
                const admins = await getAdminsWithNotificationsEnabled();
                if (admins.length > 0) {
                    const whoRole = (completedByRole || "CLIENT").toUpperCase();
                    let whoName = completedByName || "";
                    if (!whoName) {
                        switch (whoRole) {
                            case "CLIENT": whoName = subtaskData.primary_contact_name || subtaskData.client_name || "Client"; break;
                            case "CPA": whoName = subtaskData.cpa_name || "CPA"; break;
                            case "SERVICE_CENTER": whoName = subtaskData.service_center_name || "Service Center"; break;
                            default: whoName = "User";
                        }
                    }
                    for (const admin of admins) {
                        try {
                            await sendAdminTaskCompletionEmail({
                                adminEmail: admin.email, adminName: admin.name || "Admin",
                                taskTitle: subtaskData.subtask_title, clientName: subtaskData.client_name || "Unknown Client",
                                completedByRole: whoRole as 'CLIENT' | 'CPA' | 'SERVICE_CENTER',
                                completedByName: whoName, taskType: "ONBOARDING", stageName: subtaskData.stage_name,
                            });
                        } catch (err) { console.error(`❌ Failed to send to admin ${admin.email}:`, err); }
                    }
                }
            } catch (e) { console.error("❌ Admin onboarding task completion email error:", e); }
        }

        return NextResponse.json({ success: true, message: "Subtask status updated" });
    } catch (err: any) {
        console.error("POST /api/stages/subtask/update-status error:", err);
        return NextResponse.json({ success: false, error: err.message || "Failed to update subtask status" }, { status: 500 });
    }
}
