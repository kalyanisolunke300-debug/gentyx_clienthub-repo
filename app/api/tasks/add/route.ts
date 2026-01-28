import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { sendTaskNotificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("🔍 Incoming /api/tasks/add body:", body);

    const {
      clientId: rawClientId,
      taskTitle,
      title,
      description = "",
      dueDate,
      assignedToRole,
      assigneeRole,
      documentRequired = true, // Default to true for backward compatibility
      sendNotification = true, // Default to send email notification
    } = body;

    const clientId = Number(rawClientId);
    const finalTitle = taskTitle || title;
    const role = assignedToRole || assigneeRole || "CLIENT";
    const docRequired = documentRequired === true || documentRequired === 1; // Ensure boolean

    if (!clientId || !finalTitle) {
      return NextResponse.json(
        { success: false, error: "clientId and taskTitle are required" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // 1️⃣ CONNECT TO DB
    // -----------------------------------------------------
    const pool = await getDbPool();

    // -----------------------------------------------------
    // 2️⃣ VERIFY CLIENT EXISTS AND GET CLIENT DETAILS
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
        { success: false, error: "Invalid clientId" },
        { status: 404 }
      );
    }

    const client = clientResult.recordset[0];

    // -----------------------------------------------------
    // 3️⃣ GET A SAFE STAGE ID (FALLBACK – NO BLOCKING)
    // -----------------------------------------------------
    // NOTE:
    // We do NOT block task creation if client has no onboarding stages.
    // We only fetch a valid stage_id to satisfy DB constraints.
    const stageResult = await pool.request().query(`
      SELECT TOP 1 stage_id
      FROM dbo.onboarding_stages
      ORDER BY stage_id
    `);

    const stageId = stageResult.recordset[0]?.stage_id;

    if (!stageId) {
      return NextResponse.json(
        { success: false, error: "No onboarding stages configured in system" },
        { status: 500 }
      );
    }

    // -----------------------------------------------------
    // 4️⃣ AUTO-INCREMENT ORDER NUMBER (CLIENT LEVEL)
    // -----------------------------------------------------
    const orderResult = await pool
      .request()
      .input("clientId", sql.Int, clientId)
      .query(`
        SELECT ISNULL(MAX(order_number), 0) + 1 AS nextOrder
        FROM dbo.onboarding_tasks
        WHERE client_id = @clientId
      `);

    const orderNumber = orderResult.recordset[0].nextOrder;

    // -----------------------------------------------------
    // 5️⃣ INSERT SEPARATE ASSIGNED TASK
    // -----------------------------------------------------
    const insertResult = await pool
      .request()
      .input("stageId", sql.Int, stageId)
      .input("clientId", sql.Int, clientId)
      .input("taskTitle", sql.VarChar(255), finalTitle)
      .input("description", sql.VarChar(sql.MAX), description)
      .input("dueDate", sql.DateTime, dueDate || null)
      .input("assignedToRole", sql.VarChar(50), role)
      .input("orderNumber", sql.Int, orderNumber)
      .input("documentRequired", sql.Bit, docRequired ? 1 : 0)
      .query(`
        INSERT INTO dbo.onboarding_tasks
        (
          stage_id,
          client_id,
          task_title,
          description,
          assigned_to_role,
          due_date,
          status,
          order_number,
          document_required,
          created_at,
          updated_at
        )
        OUTPUT inserted.task_id
        VALUES
        (
          @stageId,
          @clientId,
          @taskTitle,
          @description,
          @assignedToRole,
          @dueDate,
          'Not Started',
          @orderNumber,
          @documentRequired,
          GETDATE(),
          GETDATE()
        )
      `);

    const taskId = insertResult.recordset[0].task_id;

    // -----------------------------------------------------
    // 6️⃣ SEND EMAIL NOTIFICATION (AUTOMATIC)
    // -----------------------------------------------------
    console.log(`📧 Email notification check: sendNotification=${sendNotification}`);

    if (sendNotification) {
      try {
        console.log(`📧 Client data for email:`, {
          client_name: client.client_name,
          primary_contact_email: client.primary_contact_email,
          cpa_email: client.cpa_email,
          service_center_email: client.service_center_email,
        });
        console.log(`📧 Task assigned to role: ${role}`);

        // Determine recipient based on assigned role
        let recipientEmail: string | null = null;
        let recipientName: string = "";
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

        console.log(`📧 Recipient determined: email=${recipientEmail}, name=${recipientName}, role=${recipientRole}`);

        if (recipientEmail) {
          console.log(`📧 Sending task assignment notification to ${recipientRole}: ${recipientEmail}`);

          const emailResult = await sendTaskNotificationEmail({
            recipientEmail,
            recipientName,
            recipientRole,
            taskTitle: finalTitle,
            taskDescription: description,
            dueDate,
            clientName: client.client_name,
            notificationType: "assigned",
            assignedByName: "Admin",
          });

          console.log(`📧 Email result:`, emailResult);

          if (emailResult.success) {
            console.log(`✅ Task notification email sent successfully to ${recipientEmail}`);
          } else {
            console.warn(`⚠️ Task notification email failed:`, emailResult.error);
          }
        } else {
          console.warn(`⚠️ No email found for ${role} role - notification skipped`);
        }
      } catch (emailError: any) {
        // Don't fail the task creation if email fails
        console.error("❌ Task notification email error:", emailError?.message || emailError);
        console.error("❌ Full error:", JSON.stringify(emailError, null, 2));
      }
    } else {
      console.log(`📧 Email notification skipped (sendNotification=false)`);
    }


    return NextResponse.json({
      success: true,
      taskId,
    });

  } catch (err: any) {
    console.error("POST /api/tasks/add error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add task" },
      { status: 500 }
    );
  }
}



//  // app/api/tasks/add/route.ts
// import { NextResponse } from "next/server";
// import { getDbPool } from "@/lib/db";
// import sql from "mssql";

// export async function POST(req: Request) {
//   try {
//     const body = await req.json();
//     console.log("🔍 Incoming /api/tasks/add body:", body);

//     const {
//       stageId: rawStageId,
//       clientId: rawClientId,
//       taskTitle: rawTaskTitle,
//       title,
//       description = "",
//       dueDate,
//       assignedToRole,
//       assigneeRole,
//       orderNumber: rawOrderNumber,
//     } = body;

//     // fallback values
//     const stageId = Number(rawStageId ?? 1);


//     const clientId = rawClientId != null ? Number(rawClientId) : undefined;
//     const taskTitle = rawTaskTitle || title;
//     const role = assignedToRole || assigneeRole || "CLIENT";
//     // const orderNumber = Number(rawOrderNumber ?? 1);

//     if (!clientId || !taskTitle) {
//       return NextResponse.json(
//         { success: false, error: "clientId and taskTitle are required" },
//         { status: 400 }
//       );
//     }

//     const pool = await getDbPool();

//     // ✅ AUTO-INCREMENT order_number per client
//     const orderResult = await pool.request()
//       .input("clientId", sql.Int, clientId)
//       .query(`
//         SELECT ISNULL(MAX(order_number), 0) + 1 AS nextOrder
//         FROM dbo.onboarding_tasks
//         WHERE client_id = @clientId
//       `);

//     const orderNumber = orderResult.recordset[0].nextOrder;


//     const result = await pool
//       .request()
//       .input("stageId", sql.Int, stageId)         // ✅ FIXED
//       .input("clientId", sql.Int, clientId)
//       .input("taskTitle", sql.VarChar(255), taskTitle)
//       .input("description", sql.VarChar(sql.MAX), description)
//       .input("dueDate", sql.DateTime, dueDate || null)
//       .input("assignedToRole", sql.VarChar(50), role)
//       .input("orderNumber", sql.Int, orderNumber)
//       .query(`
//         INSERT INTO dbo.onboarding_tasks
//         (stage_id, client_id, task_title, description, assigned_to_role, due_date, status, order_number, created_at, updated_at)
//         OUTPUT inserted.task_id
//         VALUES (@stageId, @clientId, @taskTitle, @description, @assignedToRole, @dueDate, 'Not Started', @orderNumber, GETDATE(), GETDATE());
//       `);

//     const insertedId = result.recordset[0].task_id;

//     return NextResponse.json({
//       success: true,
//       taskId: insertedId,
//     });

//   } catch (err: any) {
//     console.error("POST /api/tasks/add error:", err);
//     return NextResponse.json(
//       { success: false, error: err.message },
//       { status: 500 }
//     );
//   }
// }

// // app/api/tasks/add/route.ts
// import { NextResponse } from "next/server";
// import { getDbPool } from "@/lib/db";
// import sql from "mssql";

// export async function POST(req: Request) {
//   try {
//     const body = await req.json();
//     console.log("🔍 Incoming /api/tasks/add body:", body);

//     const {
//       clientId: rawClientId,
//       taskTitle,
//       title,
//       description = "",
//       dueDate,
//       assignedToRole,
//       assigneeRole,
//     } = body;

//     const clientId = Number(rawClientId);
//     const finalTitle = taskTitle || title;
//     const role = assignedToRole || assigneeRole || "CLIENT";

//     if (!clientId || !finalTitle) {
//       return NextResponse.json(
//         { success: false, error: "clientId and taskTitle are required" },
//         { status: 400 }
//       );
//     }

//     // ✅ 1. CONNECT TO DB FIRST
//     const pool = await getDbPool();

//     // ✅ 2. FIND A VALID STAGE FOR THIS CLIENT
//     // const stageResult = await pool
//     //   .request()
//     //   .input("clientId", sql.Int, clientId)
//     //   .query(`
//     //     SELECT TOP 1 stage_id
//     //     FROM dbo.onboarding_stages
//     //     WHERE client_id = @clientId
//     //     ORDER BY order_number
//     //   `);

//     const stageResult = await pool
//       .request()
//       .input("clientId", sql.Int, clientId)
//       .query(`
//         SELECT TOP 1 os.stage_id
//         FROM dbo.client_stages cs
//         JOIN dbo.onboarding_stages os
//           ON cs.stage_name = os.stage_name
//         WHERE cs.client_id = @clientId
//         ORDER BY cs.order_number
//       `);



//     // if (!stageResult.recordset.length) {
//     //   return NextResponse.json(
//     //     {
//     //       success: false,
//     //       error:
//     //         "No onboarding Task found for this client. Please create a stage first.",
//     //     },
//     //     { status: 400 }
//     //   );
//     // }

//     const stageId = stageResult.recordset[0].stage_id;

//     // ✅ 3. AUTO-INCREMENT ORDER NUMBER
//     const orderResult = await pool
//       .request()
//       .input("clientId", sql.Int, clientId)
//       .query(`
//         SELECT ISNULL(MAX(order_number), 0) + 1 AS nextOrder
//         FROM dbo.onboarding_tasks
//         WHERE client_id = @clientId
//       `);

//     const orderNumber = orderResult.recordset[0].nextOrder;

//     // ✅ 4. INSERT TASK WITH VALID stage_id
//     const insertResult = await pool
//       .request()
//       .input("stageId", sql.Int, stageId)
//       .input("clientId", sql.Int, clientId)
//       .input("taskTitle", sql.VarChar(255), finalTitle)
//       .input("description", sql.VarChar(sql.MAX), description)
//       .input("dueDate", sql.DateTime, dueDate || null)
//       .input("assignedToRole", sql.VarChar(50), role)
//       .input("orderNumber", sql.Int, orderNumber)
//       .query(`
//         INSERT INTO dbo.onboarding_tasks
//         (
//           stage_id,
//           client_id,
//           task_title,
//           description,
//           assigned_to_role,
//           due_date,
//           status,
//           order_number,
//           created_at,
//           updated_at
//         )
//         OUTPUT inserted.task_id
//         VALUES
//         (
//           @stageId,
//           @clientId,
//           @taskTitle,
//           @description,
//           @assignedToRole,
//           @dueDate,
//           'Not Started',
//           @orderNumber,
//           GETDATE(),
//           GETDATE()
//         )
//       `);

//     return NextResponse.json({
//       success: true,
//       taskId: insertResult.recordset[0].task_id,
//     });
//   } catch (err: any) {
//     console.error("POST /api/tasks/add error:", err);
//     return NextResponse.json(
//       { success: false, error: err.message },
//       { status: 500 }
//     );
//   }
// }
