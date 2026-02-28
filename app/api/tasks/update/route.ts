// app/api/tasks/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { calculateClientProgress } from "@/lib/progress";
import { logAudit, AuditActions } from "@/lib/audit";
import { sendTaskNotificationEmail, sendAdminTaskCompletionEmail, getAdminsWithNotificationsEnabled } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      taskId, taskTitle, dueDate, status, assignedToRole, documentRequired,
      sendNotification = false, completedByRole, completedByName,
    } = body;

    if (!taskId) {
      return NextResponse.json({ success: false, error: "taskId is required" }, { status: 400 });
    }

    const pool = await getDbPool();

    // 1️⃣ Fetch task details BEFORE update
    const taskResult = await pool.query(`
        SELECT t.task_id, t.task_title, t.due_date, t.status, t.assigned_to_role, t.document_required, t.client_id,
          c.client_name, c.primary_contact_name, c.primary_contact_email, c.cpa_id, c.service_center_id,
          cp.cpa_name, cp.email as cpa_email, sc.center_name as service_center_name, sc.email as service_center_email
        FROM public."onboarding_tasks" t
        LEFT JOIN public."Clients" c ON c.client_id = t.client_id
        LEFT JOIN public."cpa_centers" cp ON cp.cpa_id = c.cpa_id
        LEFT JOIN public."service_centers" sc ON sc.service_center_id = c.service_center_id
        WHERE t.task_id = $1
      `, [taskId]);

    const taskData = taskResult.rows[0];
    const clientId = taskData?.client_id;
    const previousStatus = taskData?.status;

    const updatedFields: string[] = [];
    if (taskTitle && taskTitle !== taskData?.task_title) updatedFields.push(`Title changed to "${taskTitle}"`);
    if (dueDate && new Date(dueDate).toDateString() !== new Date(taskData?.due_date).toDateString()) updatedFields.push(`Due date changed to ${new Date(dueDate).toLocaleDateString()}`);
    if (status && status !== taskData?.status) updatedFields.push(`Status changed to "${status}"`);
    if (assignedToRole && assignedToRole !== taskData?.assigned_to_role) updatedFields.push(`Assigned to ${assignedToRole.replace('_', ' ')}`);

    // 2️⃣ Update the task
    const docReqValue = documentRequired === true || documentRequired === 1 ? true : (documentRequired === false || documentRequired === 0 ? false : null);
    const updateResult = await pool.query(`
        UPDATE public."onboarding_tasks"
        SET task_title = COALESCE($1, task_title), due_date = COALESCE($2, due_date),
            status = COALESCE($3, status), assigned_to_role = COALESCE($4, assigned_to_role),
            document_required = COALESCE($5, document_required), updated_at = NOW()
        WHERE task_id = $6
      `, [taskTitle || null, dueDate || null, status || null, assignedToRole || null, docReqValue, taskId]);

    if (updateResult.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Task not found or no changes made" }, { status: 404 });
    }

    // 3️⃣ Recalculate progress
    if (clientId) {
      try { await calculateClientProgress(clientId); } catch (e) { console.error("Progress calculation failed:", e); }
      try {
        const isCompleted = status === "Completed";
        logAudit({ clientId, action: isCompleted ? AuditActions.TASK_COMPLETED : AuditActions.TASK_UPDATED, actorRole: "CLIENT", details: taskTitle || `Task #${taskId}` });
      } catch (e) { console.error("Audit log failed:", e); }
    }

    // 4️⃣ Admin notification on completion
    const isNewlyCompleted = status === "Completed" && previousStatus !== "Completed";
    if (isNewlyCompleted && taskData) {
      try {
        const admins = await getAdminsWithNotificationsEnabled();
        if (admins.length > 0) {
          const whoRole = (completedByRole || taskData.assigned_to_role || "CLIENT").toUpperCase();
          let whoName = completedByName || "";
          if (!whoName) {
            switch (whoRole) {
              case "CLIENT": whoName = taskData.primary_contact_name || taskData.client_name || "Client"; break;
              case "CPA": whoName = taskData.cpa_name || "CPA"; break;
              case "SERVICE_CENTER": whoName = taskData.service_center_name || "Service Center"; break;
              default: whoName = "User";
            }
          }
          for (const admin of admins) {
            try {
              await sendAdminTaskCompletionEmail({ adminEmail: admin.email, adminName: admin.name || "Admin", taskTitle: taskTitle || taskData.task_title, clientName: taskData.client_name || "Unknown Client", completedByRole: whoRole as 'CLIENT' | 'CPA' | 'SERVICE_CENTER', completedByName: whoName, taskType: "ASSIGNED" });
            } catch (err) { console.error(`❌ Failed to send to admin ${admin.email}:`, err); }
          }
        }
      } catch (e) { console.error("❌ Admin task completion email error:", e); }
    }

    // 5️⃣ Notification to assignee
    if (sendNotification && updatedFields.length > 0 && taskData) {
      try {
        const targetRole = assignedToRole || taskData.assigned_to_role || "CLIENT";
        let recipientEmail: string | null = null, recipientName = "", recipientRole: "CLIENT" | "CPA" | "SERVICE_CENTER" = "CLIENT";
        switch (targetRole.toUpperCase()) {
          case "CLIENT": recipientEmail = taskData.primary_contact_email; recipientName = taskData.primary_contact_name || taskData.client_name; recipientRole = "CLIENT"; break;
          case "CPA": recipientEmail = taskData.cpa_email; recipientName = taskData.cpa_name || "CPA"; recipientRole = "CPA"; break;
          case "SERVICE_CENTER": recipientEmail = taskData.service_center_email; recipientName = taskData.service_center_name || "Service Center"; recipientRole = "SERVICE_CENTER"; break;
        }
        if (recipientEmail) {
          await sendTaskNotificationEmail({ recipientEmail, recipientName, recipientRole, taskTitle: taskTitle || taskData.task_title, dueDate: dueDate || taskData.due_date, clientName: taskData.client_name, notificationType: "updated", updatedFields, assignedByName: "Admin" });
        }
      } catch (e) { console.error("❌ Task update notification email error:", e); }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/tasks/update error:", err);
    return NextResponse.json({ success: false, error: "Failed to update task" }, { status: 500 });
  }
}
