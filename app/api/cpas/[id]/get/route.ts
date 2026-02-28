// app/api/cpas/[id]/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request, { params }: any) {
    try {
        const { id } = await params;
        const numericId = Number(id);
        const pool = await getDbPool();

        const result = await pool.query(`
        SELECT 
          cpa_id, cpa_code, cpa_name, email, created_at, updated_at
        FROM public."cpa_centers"
        WHERE cpa_id = $1
      `, [numericId]);

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, message: "CPA not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
        console.error("GET /api/cpas/[id]/get error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
