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
      SELECT * FROM dbo.onboarding_stages
      WHERE client_id = @clientId
      ORDER BY order_number ASC;
    `);

  const tasks = await pool.request()
    .input("clientId", sql.Int, clientId)
    .query(`
      SELECT * FROM dbo.onboarding_tasks
      WHERE client_id = @clientId
      ORDER BY order_number ASC;
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
  if (tasksForStage.length === 0) return "Pending";

  const completed = tasksForStage.filter(t => t.status === "Completed").length;

  if (completed === tasksForStage.length) return "Completed";
  if (completed > 0) return "In Progress";

  return "Pending";
}

// ---------------------------------------------------------
// MAIN LOGIC — Calculate overall client progress
// ---------------------------------------------------------
export async function calculateClientProgress(clientId: number) {
  const pool = await getDbPool();

  const { stages, tasks } = await fetchClientStagesAndTasks(clientId);

  if (stages.length === 0) return { progress: 0, newStage: null };

  let totalStages = stages.length;
  let completedStages = 0;

  for (const stage of stages) {
    const stageTasks = tasks.filter(t => t.stage_id === stage.stage_id);
    const stageStatus = calculateStageStatus(stageTasks);

    if (stageStatus === "Completed") completedStages++;

    // Update stage status in DB
    await pool.request()
      .input("stageId", sql.Int, stage.stage_id)
      .input("stageStatus", sql.VarChar(50), stageStatus)
      .query(`
        UPDATE dbo.onboarding_stages
        SET status = @stageStatus,
            updated_at = GETDATE()
        WHERE stage_id = @stageId;
      `);
  }

  // Calculate client progress %
  const progress = Math.round((completedStages / totalStages) * 100);

  // Determine the NEXT ACTIVE STAGE
  const nextStage = stages.find(s => s.status !== "Completed") || null;

  // Update client in DB
  await pool.request()
    .input("clientId", sql.Int, clientId)
    .input("progress", sql.Int, progress)
    .input("stageId", sql.Int, nextStage?.stage_id || null)
    .input("stageName", sql.VarChar(255), nextStage?.stage_name || null)
    .input("status", sql.VarChar(50), progress === 100 ? "Completed" : "In Progress")
    .query(`
      UPDATE dbo.Clients
      SET 
        progress = @progress,
        stage_id = @stageId,
        status = @status,
        updated_at = GETDATE()
      WHERE client_id = @clientId;
    `);

  return {
    progress,
    nextStage
  };
}
