// app/api/tasks/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { calculateClientProgress } from "@/lib/progress";
import { logAudit, AuditActions } from "@/lib/audit";
import { sendTaskNotificationEmail, sendAdminTaskCompletionEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      taskId,
      taskTitle,
      dueDate,
      status,
      assignedToRole,
      documentRequired,
      sendNotification = false, // Default to NOT send for updates (can be enabled by frontend)
      completedByRole, // Optional: who completed the task (CLIENT, CPA, SERVICE_CENTER)
      completedByName, // Optional: name of who completed (if known)
    } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // -----------------------------------------------------
    // 1️⃣ Fetch task details and client info BEFORE update
    // -----------------------------------------------------
    const taskResult = await pool.request()
      .input("taskId", sql.Int, taskId)
      .query(`
        SELECT 
          t.task_id,
          t.task_title,
          t.due_date,
          t.status,
          t.assigned_to_role,
          t.document_required,
          t.client_id,
          c.client_name,
          c.primary_contact_name,
          c.primary_contact_email,
          c.cpa_id,
          c.service_center_id,
          cp.cpa_name,
          cp.email as cpa_email,
          sc.center_name as service_center_name,
          sc.email as service_center_email
        FROM dbo.onboarding_tasks t
        LEFT JOIN dbo.Clients c ON c.client_id = t.client_id
        LEFT JOIN dbo.cpa_centers cp ON cp.cpa_id = c.cpa_id
        LEFT JOIN dbo.service_centers sc ON sc.service_center_id = c.service_center_id
        WHERE t.task_id = @taskId;
      `);

    const taskData = taskResult.recordset[0];
    const clientId = taskData?.client_id;
    const previousStatus = taskData?.status;

    // Track what fields are being updated for the notification
    const updatedFields: string[] = [];
    if (taskTitle && taskTitle !== taskData?.task_title) {
      updatedFields.push(`Title changed to "${taskTitle}"`);
    }
    if (dueDate && new Date(dueDate).toDateString() !== new Date(taskData?.due_date).toDateString()) {
      updatedFields.push(`Due date changed to ${new Date(dueDate).toLocaleDateString()}`);
    }
    if (status && status !== taskData?.status) {
      updatedFields.push(`Status changed to "${status}"`);
    }
    if (assignedToRole && assignedToRole !== taskData?.assigned_to_role) {
      updatedFields.push(`Assigned to ${assignedToRole.replace('_', ' ')}`);
    }

    // -----------------------------------------------------
    // 2️⃣ Update the task
    // -----------------------------------------------------
    const updateResult = await pool.request()
      .input("taskId", sql.Int, taskId)
      .input("taskTitle", sql.VarChar(255), taskTitle)
      .input("dueDate", sql.DateTime, dueDate || null)
      .input("status", sql.VarChar(50), status)
      .input("assignedToRole", sql.VarChar(50), assignedToRole)
      .input("documentRequired", sql.Bit, documentRequired === true || documentRequired === 1 ? 1 : (documentRequired === false || documentRequired === 0 ? 0 : null))
      .query(`
        UPDATE dbo.onboarding_tasks
        SET
          task_title = COALESCE(@taskTitle, task_title),
          due_date = COALESCE(@dueDate, due_date),
          status = COALESCE(@status, status),
          assigned_to_role = COALESCE(@assignedToRole, assigned_to_role),
          document_required = COALESCE(@documentRequired, document_required),
          updated_at = GETDATE()
        WHERE task_id = @taskId;
      `);

    // Check if any row was updated
    if (updateResult.rowsAffected[0] === 0) {
      return NextResponse.json(
        { success: false, error: "Task not found or no changes made" },
        { status: 404 }
      );
    }

    // -----------------------------------------------------
    // 3️⃣ Recalculate the client's progress (MAIN LOGIC)
    // -----------------------------------------------------
    if (clientId) {
      try {
        await calculateClientProgress(clientId);
      } catch (progressError) {
        console.error("Progress calculation failed:", progressError);
        // Don't fail the entire request - task was already updated
      }

      // Audit log
      try {
        const isCompleted = status === "Completed";
        logAudit({
          clientId,
          action: isCompleted ? AuditActions.TASK_COMPLETED : AuditActions.TASK_UPDATED,
          actorRole: "CLIENT",
          details: taskTitle || `Task #${taskId}`,
        });
      } catch (auditError) {
        console.error("Audit log failed:", auditError);
        // Don't fail the entire request
      }
    }

    // -----------------------------------------------------
    // 4️⃣ SEND EMAIL TO ADMIN ON TASK COMPLETION
    // -----------------------------------------------------
    const isNewlyCompleted = status === "Completed" && previousStatus !== "Completed";

    if (isNewlyCompleted && taskData) {
      try {
        console.log("📧 Task completed - sending admin notification...");

        // Get admin email
        const adminResult = await pool.request().query(`SELECT TOP 1 email, full_name FROM AdminSettings WHERE email IS NOT NULL`);
        const admin = adminResult.recordset[0];

        if (admin?.email) {
          // Determine who completed the task
          const whoRole = (completedByRole || taskData.assigned_to_role || "CLIENT").toUpperCase();
          let whoName = completedByName || "";

          // If no explicit name, try to determine from task data
          if (!whoName) {
            switch (whoRole) {
              case "CLIENT":
                whoName = taskData.primary_contact_name || taskData.client_name || "Client";
                break;
              case "CPA":
                whoName = taskData.cpa_name || "CPA";
                break;
              case "SERVICE_CENTER":
                whoName = taskData.service_center_name || "Service Center";
                break;
              default:
                whoName = "User";
            }
          }

          const emailResult = await sendAdminTaskCompletionEmail({
            adminEmail: admin.email,
            adminName: admin.full_name || "Admin",
            taskTitle: taskTitle || taskData.task_title,
            clientName: taskData.client_name || "Unknown Client",
            completedByRole: whoRole as 'CLIENT' | 'CPA' | 'SERVICE_CENTER',
            completedByName: whoName,
            taskType: "ASSIGNED",
          });

          if (emailResult.success) {
            console.log(`✅ Admin task completion notification sent to ${admin.email}`);
          } else {
            console.warn(`⚠️ Admin task completion notification failed:`, emailResult.error);
          }
        } else {
          console.warn("⚠️ No admin email configured - skipping completion notification");
        }
      } catch (adminEmailError) {
        console.error("❌ Admin task completion email error:", adminEmailError);
        // Don't fail the request
      }
    }

    // -----------------------------------------------------
    // 5️⃣ SEND EMAIL NOTIFICATION TO ASSIGNEE (IF ENABLED)
    // -----------------------------------------------------
    if (sendNotification && updatedFields.length > 0 && taskData) {
      try {
        // Determine the recipient - use the NEW assigned role if it changed, else use current
        const targetRole = assignedToRole || taskData.assigned_to_role || "CLIENT";

        let recipientEmail: string | null = null;
        let recipientName: string = "";
        let recipientRole: "CLIENT" | "CPA" | "SERVICE_CENTER" = "CLIENT";

        switch (targetRole.toUpperCase()) {
          case "CLIENT":
            recipientEmail = taskData.primary_contact_email;
            recipientName = taskData.primary_contact_name || taskData.client_name;
            recipientRole = "CLIENT";
            break;

          case "CPA":
            recipientEmail = taskData.cpa_email;
            recipientName = taskData.cpa_name || "CPA";
            recipientRole = "CPA";
            break;

          case "SERVICE_CENTER":
            recipientEmail = taskData.service_center_email;
            recipientName = taskData.service_center_name || "Service Center";
            recipientRole = "SERVICE_CENTER";
            break;
        }

        if (recipientEmail) {
          console.log(`📧 Sending task update notification to ${recipientRole}: ${recipientEmail}`);

          const emailResult = await sendTaskNotificationEmail({
            recipientEmail,
            recipientName,
            recipientRole,
            taskTitle: taskTitle || taskData.task_title,
            dueDate: dueDate || taskData.due_date,
            clientName: taskData.client_name,
            notificationType: "updated",
            updatedFields,
            assignedByName: "Admin",
          });

          if (emailResult.success) {
            console.log(`✅ Task update notification email sent successfully to ${recipientEmail}`);
          } else {
            console.warn(`⚠️ Task update notification email failed:`, emailResult.error);
          }
        } else {
          console.warn(`⚠️ No email found for ${targetRole} role - notification skipped`);
        }
      } catch (emailError) {
        // Don't fail the task update if email fails
        console.error("❌ Task update notification email error:", emailError);
      }
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("POST /api/tasks/update error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update task" },
      { status: 500 }
    );
  }
}

