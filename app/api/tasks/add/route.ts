import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { sendTaskNotificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("🔍 Incoming /api/tasks/add body:", body);

    const {
      clientId: rawClientId, taskTitle, title, description = "",
      dueDate, assignedToRole, assigneeRole,
      documentRequired = true, sendNotification = true,
    } = body;

    const clientId = Number(rawClientId);
    const finalTitle = taskTitle || title;
    const role = assignedToRole || assigneeRole || "CLIENT";
    const docRequired = documentRequired === true || documentRequired === 1;

    if (!clientId || !finalTitle) {
      return NextResponse.json({ success: false, error: "clientId and taskTitle are required" }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get client details
    const clientResult = await pool.query(`
        SELECT c.client_id, c.client_name, c.primary_contact_name, c.primary_contact_email,
          c.cpa_id, c.service_center_id, cp.cpa_name, cp.email as cpa_email,
          sc.center_name as service_center_name, sc.email as service_center_email
        FROM public."Clients" c
        LEFT JOIN public."cpa_centers" cp ON cp.cpa_id = c.cpa_id
        LEFT JOIN public."service_centers" sc ON sc.service_center_id = c.service_center_id
        WHERE c.client_id = $1
      `, [clientId]);

    if (!clientResult.rows.length) {
      return NextResponse.json({ success: false, error: "Invalid clientId" }, { status: 404 });
    }

    const client = clientResult.rows[0];

    // Get a safe stage ID
    const stageResult = await pool.query(`SELECT stage_id FROM public."onboarding_stages" ORDER BY stage_id LIMIT 1`);
    const stageId = stageResult.rows[0]?.stage_id;
    if (!stageId) {
      return NextResponse.json({ success: false, error: "No onboarding stages configured in system" }, { status: 500 });
    }

    // Auto-increment order number
    const orderResult = await pool.query(
      `SELECT COALESCE(MAX(order_number), 0) + 1 AS "nextOrder" FROM public."onboarding_tasks" WHERE client_id = $1`,
      [clientId]
    );
    const orderNumber = orderResult.rows[0].nextOrder;

    // INSERT TASK
    const insertResult = await pool.query(`
        INSERT INTO public."onboarding_tasks"
        (stage_id, client_id, task_title, description, assigned_to_role, due_date, status, order_number, document_required, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'Not Started', $7, $8, NOW(), NOW())
        RETURNING task_id
      `, [stageId, clientId, finalTitle, description, role, dueDate || null, orderNumber, docRequired]);

    const taskId = insertResult.rows[0].task_id;

    // SEND EMAIL NOTIFICATION
    if (sendNotification) {
      try {
        let recipientEmail: string | null = null;
        let recipientName = "";
        let recipientRole: "CLIENT" | "CPA" | "SERVICE_CENTER" = "CLIENT";

        switch (role.toUpperCase()) {
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
        }

        if (recipientEmail) {
          const emailResult = await sendTaskNotificationEmail({
            recipientEmail, recipientName, recipientRole,
            taskTitle: finalTitle, taskDescription: description, dueDate,
            clientName: client.client_name, notificationType: "assigned", assignedByName: "Admin",
          });
          if (emailResult.success) {
            console.log(`✅ Task notification email sent to ${recipientEmail}`);
          }
        }
      } catch (emailError: any) {
        console.error("❌ Task notification email error:", emailError?.message || emailError);
      }
    }

    return NextResponse.json({ success: true, taskId });
  } catch (err: any) {
    console.error("POST /api/tasks/add error:", err);
    return NextResponse.json({ success: false, error: "Failed to add task" }, { status: 500 });
  }
}
