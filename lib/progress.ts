import { getDbPool } from "@/lib/db";
import sql from "mssql";

// ---------------------------------------------------------
// Fetch all stages + tasks for a client
// ---------------------------------------------------------
export async function fetchClientStagesAndTasks(clientId: number) {
  const pool = await getDbPool();

  const stages = await pool.request()
    .input("clientId", sql.Int, clientId)
    .query(`
      SELECT * FROM dbo.client_stages
      WHERE client_id = @clientId
      ORDER BY order_number ASC;
    `);

  // Tasks are now subtasks linked via client_stage_id
  const tasks = await pool.request()
    .input("clientId", sql.Int, clientId)
    .query(`
      SELECT t.* 
      FROM dbo.client_stage_subtasks t
      INNER JOIN dbo.client_stages s ON t.client_stage_id = s.client_stage_id
      WHERE s.client_id = @clientId
      ORDER BY t.order_number ASC;
    `);

  return {
    stages: stages.recordset,
    tasks: tasks.recordset
  };
}

// ---------------------------------------------------------
// Calculate stage completion: Completed if ALL tasks are done
// ---------------------------------------------------------
function calculateStageStatus(tasksForStage: any[]) {
  if (tasksForStage.length === 0) return "Not Started";
  // NOTE: If a stage has no tasks, is it completed? 
  // User logic implies validity depends on subtasks. 
  // If no subtasks, we assume "Not Started" or let manual override apply.
  // But usually stages should have subtasks. 
  // Let's stick to "Not Started" if empty, or checking previous behavior.
  // Previous used "Pending". "Not Started" seems safer.

  const allCompleted = tasksForStage.every(t => (t.status || "").toLowerCase() === "completed");

  if (allCompleted) return "Completed";

  // Check if any is in progress or completed
  const anyStarted = tasksForStage.some(t => {
    const s = (t.status || "").toLowerCase();
    return s === "completed" || s === "in progress";
  });

  if (anyStarted) return "In Progress";

  return "Not Started";
}

// ---------------------------------------------------------
// MAIN LOGIC — Calculate overall client progress
// ---------------------------------------------------------
export async function calculateClientProgress(clientId: number) {
  const pool = await getDbPool();

  const { stages, tasks } = await fetchClientStagesAndTasks(clientId);

  if (stages.length === 0) {
    // No stages found, ensure progress is 0
    await updateClientProgressInDb(pool, clientId, 0, null, null, "Not Started");
    return { progress: 0, nextStage: null };
  }

  let totalStages = stages.length;
  let completedStages = 0;

  for (const stage of stages) {
    const stageTasks = tasks.filter(t => t.client_stage_id === stage.client_stage_id);

    // Determine status purely from subtasks
    const calculatedStatus = calculateStageStatus(stageTasks);

    // Note: In some designs, stages status might be explicitly set by user. 
    // However, the user request explicitly says: "progress bar will work when one of stage completed all its sub task"
    // So we enforce the calculated status.

    if (calculatedStatus === "Completed") completedStages++;

    // Update stage status in DB if it differs
    if (stage.status !== calculatedStatus) {
      await pool.request()
        .input("stageId", sql.Int, stage.client_stage_id)
        .input("stageStatus", sql.VarChar(50), calculatedStatus)
        .query(`
          UPDATE dbo.client_stages
          SET status = @stageStatus,
              updated_at = GETDATE()
          WHERE client_stage_id = @stageId;
        `);

      // Update local object for next step
      stage.status = calculatedStatus;
    }
  }

  // Calculate client progress %
  const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  // Determine the NEXT ACTIVE STAGE (First non-completed stage)
  const nextStage = stages.find(s => s.status !== "Completed") || null;
  const clientStatus = progress === 100 ? "Completed" : (progress > 0 ? "In Progress" : "Not Started");

  await updateClientProgressInDb(pool, clientId, progress, nextStage?.client_stage_id || null, nextStage?.stage_name || null, clientStatus);

  return {
    progress,
    nextStage
  };
}

async function updateClientProgressInDb(pool: any, clientId: number, progress: number, stageId: number | null, stageName: string | null, status: string) {
  await pool.request()
    .input("clientId", sql.Int, clientId)
    .input("progress", sql.Int, progress)
    .input("stageId", sql.Int, stageId)
    .input("stageName", sql.VarChar(255), stageName)
    .input("status", sql.VarChar(50), status)
    .query(`
      UPDATE dbo.Clients
      SET 
        progress = @progress,
        stage_id = @stageId,
        status = @status,
        updated_at = GETDATE()
      WHERE client_id = @clientId;
    `);
}
