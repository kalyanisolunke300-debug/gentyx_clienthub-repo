// app/api/cpas/debug/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
    try {
        const pool = await getDbPool();

        const cpas = await pool.query(`SELECT cpa_id, cpa_code, cpa_name, email FROM public."cpa_centers"`);
        const users = await pool.query(`SELECT id, email, role FROM public."Users" WHERE role = 'CPA'`);

        const cpaList = cpas.rows;
        const userEmails = users.rows.map((u: any) => u.email?.toLowerCase());

        const unmatchedCpas = cpaList.filter((cpa: any) => {
            if (!cpa.email) return true;
            return !userEmails.includes(cpa.email?.toLowerCase());
        });

        return NextResponse.json({
            cpas: cpas.rows,
            users: users.rows,
            unmatchedCpas,
            message: unmatchedCpas.length > 0
                ? `Found ${unmatchedCpas.length} CPA(s) without matching user accounts`
                : "All CPAs have user accounts"
        });
    } catch (err: any) {
        console.error("Debug error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}
