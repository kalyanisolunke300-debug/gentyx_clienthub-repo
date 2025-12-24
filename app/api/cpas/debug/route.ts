// app/api/cpas/debug/route.ts
// Debug endpoint to check CPA and user data
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
    try {
        const pool = await getDbPool();

        // Get all CPAs
        const cpas = await pool.request().query(`
      SELECT cpa_id, cpa_code, cpa_name, email FROM cpa_centers
    `);

        // Get all CPA users
        const users = await pool.request().query(`
      SELECT id, email, role FROM Users WHERE role = 'CPA'
    `);

        // Check which CPAs don't have matching users
        const cpaList = cpas.recordset;
        const userEmails = users.recordset.map((u: any) => u.email?.toLowerCase());

        const unmatchedCpas = cpaList.filter((cpa: any) => {
            if (!cpa.email) return true;
            return !userEmails.includes(cpa.email?.toLowerCase());
        });

        return NextResponse.json({
            cpas: cpas.recordset,
            users: users.recordset,
            unmatchedCpas,
            message: unmatchedCpas.length > 0
                ? `Found ${unmatchedCpas.length} CPA(s) without matching user accounts`
                : "All CPAs have user accounts"
        });
    } catch (err: any) {
        console.error("Debug error:", err);
        return NextResponse.json(
            { success: false, message: err.message },
            { status: 500 }
        );
    }
}
