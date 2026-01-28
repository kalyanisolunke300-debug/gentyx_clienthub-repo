// app/api/stages/subtask/update-status/route.ts
import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";
import { sendAdminTaskCompletionEmail } from "@/lib/email";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { subtaskId, status, completedByRole, completedByName } = body;

        if (!subtaskId) {
            return NextResponse.json(
                { success: false, error: "Missing subtaskId" },
                { status: 400 }
            );
        }

        if (!status) {
            return NextResponse.json(
                { success: false, error: "Missing status" },
                { status: 400 }
            );
        }

        const pool = await getDbPool();

        // First, fetch the subtask details BEFORE update (to check if this is a NEW completion)
        const subtaskResult = await pool
            .request()
            .input("subtaskId", sql.Int, subtaskId)
            .query(`
                SELECT 
                    s.subtask_id,
                    s.subtask_title,
                    s.status as previous_status,
                    cs.stage_name,
                    cs.client_id,
                    c.client_name,
                    c.primary_contact_name,
                    c.cpa_id,
                    c.service_center_id,
                    cp.cpa_name,
                    sc.center_name as service_center_name
                FROM dbo.client_stage_subtasks s
                JOIN dbo.client_stages cs ON cs.client_stage_id = s.client_stage_id
                LEFT JOIN dbo.Clients c ON c.client_id = cs.client_id
                LEFT JOIN dbo.cpa_centers cp ON cp.cpa_id = c.cpa_id
                LEFT JOIN dbo.service_centers sc ON sc.service_center_id = c.service_center_id
                WHERE s.subtask_id = @subtaskId
            `);

        const subtaskData = subtaskResult.recordset[0];
        const previousStatus = subtaskData?.previous_status;

        // Update subtask status
        await pool
            .request()
            .input("subtaskId", sql.Int, subtaskId)
            .input("status", sql.NVarChar(50), status)
            .query(`
        UPDATE dbo.client_stage_subtasks
        SET status = @status,
            updated_at = GETDATE()
        WHERE subtask_id = @subtaskId
      `);

        // Check if this is a NEW completion (status changed to Completed)
        const isNewlyCompleted = status === "Completed" && previousStatus !== "Completed";

        if (isNewlyCompleted && subtaskData) {
            try {
                console.log("📧 Onboarding subtask completed - sending admin notification...");

                // Get admin email
                const adminResult = await pool.request().query(`SELECT TOP 1 email, full_name FROM AdminSettings WHERE email IS NOT NULL`);
                const admin = adminResult.recordset[0];

                if (admin?.email) {
                    // Determine who completed the task
                    const whoRole = (completedByRole || "CLIENT").toUpperCase();
                    let whoName = completedByName || "";

                    // If no explicit name, try to determine from subtask data
                    if (!whoName) {
                        switch (whoRole) {
                            case "CLIENT":
                                whoName = subtaskData.primary_contact_name || subtaskData.client_name || "Client";
                                break;
                            case "CPA":
                                whoName = subtaskData.cpa_name || "CPA";
                                break;
                            case "SERVICE_CENTER":
                                whoName = subtaskData.service_center_name || "Service Center";
                                break;
                            default:
                                whoName = "User";
                        }
                    }

                    const emailResult = await sendAdminTaskCompletionEmail({
                        adminEmail: admin.email,
                        adminName: admin.full_name || "Admin",
                        taskTitle: subtaskData.subtask_title,
                        clientName: subtaskData.client_name || "Unknown Client",
                        completedByRole: whoRole as 'CLIENT' | 'CPA' | 'SERVICE_CENTER',
                        completedByName: whoName,
                        taskType: "ONBOARDING",
                        stageName: subtaskData.stage_name,
                    });

                    if (emailResult.success) {
                        console.log(`✅ Admin onboarding task completion notification sent to ${admin.email}`);
                    } else {
                        console.warn(`⚠️ Admin onboarding task completion notification failed:`, emailResult.error);
                    }
                } else {
                    console.warn("⚠️ No admin email configured - skipping completion notification");
                }
            } catch (adminEmailError) {
                console.error("❌ Admin onboarding task completion email error:", adminEmailError);
                // Don't fail the request
            }
        }

        return NextResponse.json({
            success: true,
            message: "Subtask status updated"
        });

    } catch (err: any) {
        console.error("POST /api/stages/subtask/update-status error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update subtask status" },
            { status: 500 }
        );
    }
}

