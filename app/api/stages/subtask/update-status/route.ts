// app/api/stages/subtask/update-status/route.ts
import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { subtaskId, status } = body;

        if (!subtaskId) {
            return NextResponse.json(
                { success: false, error: "Missing subtaskId" },
                { status: 400 }
            );
        }

        if (!status) {
            return NextResponse.json(
                { success: false, error: "Missing status" },
                { status: 400 }
            );
        }

        const pool = await getDbPool();

        // Update subtask status
        await pool
            .request()
            .input("subtaskId", sql.Int, subtaskId)
            .input("status", sql.NVarChar(50), status)
            .query(`
        UPDATE dbo.client_stage_subtasks
        SET status = @status,
            updated_at = GETDATE()
        WHERE subtask_id = @subtaskId
      `);

        return NextResponse.json({
            success: true,
            message: "Subtask status updated"
        });

    } catch (err: any) {
        console.error("POST /api/stages/subtask/update-status error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update subtask status" },
            { status: 500 }
        );
    }
}
