// api/tasks/client/[clientId]/route.ts
import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

export async function GET(
    req: Request,
    { params }: { params: { clientId: string } }
) {
    try {
        const clientId = Number(params.clientId);

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "Invalid clientId" },
                { status: 400 }
            );
        }

        const pool = await getDbPool();

        const result = await pool
            .request()
            .input("clientId", sql.Int, clientId)
            .query(`
        SELECT
        t.task_id AS id,
        t.task_title AS title,
        t.status,
        t.due_date AS dueDate,
        s.stage_name AS stage
        FROM dbo.onboarding_tasks t
        LEFT JOIN dbo.onboarding_stages s
        ON s.stage_id = t.stage_id
        WHERE t.client_id = @clientId
        ORDER BY t.created_at DESC
      `);

        return NextResponse.json({
            success: true,
            data: result.recordset,
        });
    } catch (err: any) {
        console.error("GET /api/tasks/client/[clientId] error:", err);

        return NextResponse.json(
            { success: false, error: "Failed to fetch client tasks" },
            { status: 500 }
        );
    }
}
