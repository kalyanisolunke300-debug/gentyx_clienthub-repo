// app/api/notifications/task/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { sendTaskNotificationEmail, sendOnboardingTaskNotificationEmail } from "@/lib/email";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("📧 Task notification request:", body);

        const {
            taskId,
            taskTitle,
            taskDescription,
            dueDate,
            clientId,
            assignedToRole,
            notificationType = "assigned", // 'assigned' | 'updated'
            taskType = "ASSIGNED", // 'ASSIGNED' | 'ONBOARDING'
            stageName, // For onboarding tasks
            updatedFields, // For updates
            assignedByName,
        } = body;

        // Validate required fields
        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "clientId is required" },
                { status: 400 }
            );
        }

        if (!taskTitle) {
            return NextResponse.json(
                { success: false, error: "taskTitle is required" },
                { status: 400 }
            );
        }

        if (!assignedToRole) {
            return NextResponse.json(
                { success: false, error: "assignedToRole is required" },
                { status: 400 }
            );
        }

        const pool = await getDbPool();

        // -----------------------------------------------------
        // 1️⃣ FETCH CLIENT DETAILS
        // -----------------------------------------------------
        const clientResult = await pool
            .request()
            .input("clientId", sql.Int, clientId)
            .query(`
        SELECT 
          c.client_id,
          c.client_name,
          c.primary_contact_name,
          c.primary_contact_email,
          c.cpa_id,
          c.service_center_id,
          cp.cpa_name,
          cp.email as cpa_email,
          sc.center_name as service_center_name,
          sc.email as service_center_email
        FROM dbo.Clients c
        LEFT JOIN dbo.cpa_centers cp ON cp.cpa_id = c.cpa_id
        LEFT JOIN dbo.service_centers sc ON sc.service_center_id = c.service_center_id
        WHERE c.client_id = @clientId
      `);

        if (!clientResult.recordset.length) {
            return NextResponse.json(
                { success: false, error: "Client not found" },
                { status: 404 }
            );
        }

        const client = clientResult.recordset[0];

        // -----------------------------------------------------
        // 2️⃣ DETERMINE RECIPIENT BASED ON ROLE
        // -----------------------------------------------------
        let recipientEmail: string | null = null;
        let recipientName: string = "";
        let recipientRole: "CLIENT" | "CPA" | "SERVICE_CENTER" = "CLIENT";

        switch (assignedToRole.toUpperCase()) {
            case "CLIENT":
                recipientEmail = client.primary_contact_email;
                recipientName = client.primary_contact_name || client.client_name;
                recipientRole = "CLIENT";
                break;

            case "CPA":
                recipientEmail = client.cpa_email;
                recipientName = client.cpa_name || "CPA";
                recipientRole = "CPA";
                break;

            case "SERVICE_CENTER":
                recipientEmail = client.service_center_email;
                recipientName = client.service_center_name || "Service Center";
                recipientRole = "SERVICE_CENTER";
                break;

            default:
                return NextResponse.json(
                    { success: false, error: `Unknown assignedToRole: ${assignedToRole}` },
                    { status: 400 }
                );
        }

        // Check if we have a valid email
        if (!recipientEmail) {
            console.warn(`⚠️ No email found for ${assignedToRole} role`);
            return NextResponse.json({
                success: false,
                error: `No email address found for ${assignedToRole}. The user may not have an email configured.`,
                skipped: true,
            });
        }

        console.log(`📧 Sending ${notificationType} notification to ${recipientRole}: ${recipientEmail}`);

        // -----------------------------------------------------
        // 3️⃣ SEND EMAIL NOTIFICATION
        // -----------------------------------------------------
        let emailResult;

        if (taskType === "ONBOARDING" && stageName) {
            // Use onboarding task notification
            emailResult = await sendOnboardingTaskNotificationEmail({
                recipientEmail,
                recipientName,
                recipientRole,
                stageName,
                subtaskTitle: taskTitle,
                clientName: client.client_name,
                notificationType: notificationType as "assigned" | "updated" | "completed",
                dueDate,
                assignedByName,
            });
        } else {
            // Use regular task notification
            emailResult = await sendTaskNotificationEmail({
                recipientEmail,
                recipientName,
                recipientRole,
                taskTitle,
                taskDescription,
                dueDate,
                clientName: client.client_name,
                notificationType: notificationType as "assigned" | "updated",
                updatedFields,
                assignedByName,
            });
        }

        if (emailResult.success) {
            console.log(`✅ Task notification email sent successfully to ${recipientEmail}`);
            return NextResponse.json({
                success: true,
                message: `Notification sent to ${recipientRole} (${recipientEmail})`,
                messageId: emailResult.messageId,
            });
        } else {
            console.error(`❌ Failed to send task notification email:`, emailResult.error);
            return NextResponse.json(
                {
                    success: false,
                    error: emailResult.error || "Failed to send notification email"
                },
                { status: 500 }
            );
        }

    } catch (err: any) {
        console.error("POST /api/notifications/task error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to send task notification" },
            { status: 500 }
        );
    }
}
