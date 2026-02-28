// api/tasks/client/[clientId]/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ clientId: string }> }
) {
    try {
        const { clientId: clientIdParam } = await params;
        const clientId = Number(clientIdParam);

        if (!clientId) {
            return NextResponse.json({ success: false, error: "Invalid clientId" }, { status: 400 });
        }

        const pool = await getDbPool();

        const result = await pool.query(`
        SELECT t.task_id AS id, t.task_title AS title, t.status, t.order_number,
          t.due_date AS "dueDate", t.created_at AS "createdAt",
          COALESCE(t.document_required, true) AS "documentRequired",
          s.stage_name AS stage
        FROM public."onboarding_tasks" t
        LEFT JOIN public."onboarding_stages" s ON s.stage_id = t.stage_id
        WHERE t.client_id = $1
        ORDER BY t.created_at DESC
      `, [clientId]);

        return NextResponse.json({ success: true, data: result.rows });
    } catch (err: any) {
        console.error("GET /api/tasks/client/[clientId] error:", err);
        return NextResponse.json({ success: false, error: "Failed to fetch client tasks" }, { status: 500 });
    }
}
