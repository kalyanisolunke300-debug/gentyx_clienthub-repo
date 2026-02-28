import { getDbPool } from "@/lib/db";

// ---------------------------------------------------------
// Fetch all stages + tasks for a client
// ---------------------------------------------------------
export async function fetchClientStagesAndTasks(clientId: number) {
  const pool = await getDbPool();

  const stages = await pool.query(
    `SELECT * FROM public."client_stages" WHERE client_id = $1 ORDER BY order_number ASC`,
    [clientId]
  );

  const tasks = await pool.query(
    `SELECT t.* FROM public."client_stage_subtasks" t
     INNER JOIN public."client_stages" s ON t.client_stage_id = s.client_stage_id
     WHERE s.client_id = $1 ORDER BY t.order_number ASC`,
    [clientId]
  );

  return {
    stages: stages.rows,
    tasks: tasks.rows
  };
}

// ---------------------------------------------------------
// Calculate stage completion: Completed if ALL tasks are done
// ---------------------------------------------------------
function calculateStageStatus(tasksForStage: any[]) {
  if (tasksForStage.length === 0) return "Not Started";
  const allCompleted = tasksForStage.every(t => (t.status || "").toLowerCase() === "completed");
  if (allCompleted) return "Completed";
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
    await updateClientProgressInDb(pool, clientId, 0, null, null, "Not Started");
    return { progress: 0, nextStage: null };
  }

  let totalStages = stages.length;
  let completedStages = 0;

  for (const stage of stages) {
    const stageTasks = tasks.filter((t: any) => t.client_stage_id === stage.client_stage_id);
    const calculatedStatus = calculateStageStatus(stageTasks);
    if (calculatedStatus === "Completed") completedStages++;

    if (stage.status !== calculatedStatus) {
      await pool.query(
        `UPDATE public."client_stages" SET status = $1, updated_at = NOW() WHERE client_stage_id = $2`,
        [calculatedStatus, stage.client_stage_id]
      );
      stage.status = calculatedStatus;
    }
  }

  const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
  const nextStage = stages.find((s: any) => s.status !== "Completed") || null;
  const clientStatus = progress === 100 ? "Completed" : (progress > 0 ? "In Progress" : "Not Started");

  await updateClientProgressInDb(pool, clientId, progress, nextStage?.client_stage_id || null, nextStage?.stage_name || null, clientStatus);

  return { progress, nextStage };
}

async function updateClientProgressInDb(pool: any, clientId: number, progress: number, stageId: number | null, stageName: string | null, status: string) {
  await pool.query(
    `UPDATE public."Clients" SET progress = $1, stage_id = $2, client_status = $3, updated_at = NOW() WHERE client_id = $4`,
    [progress, stageId, status, clientId]
  );
}
