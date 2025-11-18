import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const pool = await getDbPool();

    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 10);
    const offset = (page - 1) * pageSize;

    const taskResult = await pool.request()
      .input("offset", sql.Int, offset)
      .input("pageSize", sql.Int, pageSize)
      .query(`
        SELECT 
          task_id AS id,
          client_id AS clientId,
          title,
          assignee_role AS assigneeRole,
          status,
          due_date,
          created_at
        FROM dbo.Tasks
        ORDER BY task_id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
      `);

    const countResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dbo.Tasks;
    `);

    return NextResponse.json({
      success: true,
      data: taskResult.recordset,
      page,
      pageSize,
      total: countResult.recordset[0].total,
    });

  } catch (err: any) {
    console.error("GET /api/tasks/list error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
