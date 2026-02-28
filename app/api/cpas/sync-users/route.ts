// app/api/cpas/sync-users/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

const DEFAULT_PASSWORD = "Cpa@12345";

export async function POST() {
    try {
        const pool = await getDbPool();

        const cpasWithoutUsers = await pool.query(`
      SELECT c.cpa_id, c.cpa_name, c.email
      FROM public."cpa_centers" c
      WHERE c.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public."Users" u WHERE u.email = c.email
        )
    `);

        const cpasToCreate = cpasWithoutUsers.rows;
        let created = 0;
        const createdList: string[] = [];

        for (const cpa of cpasToCreate) {
            try {
                await pool.query(`
            INSERT INTO public."Users" (email, password, role)
            VALUES ($1, $2, $3)
          `, [cpa.email, DEFAULT_PASSWORD, "CPA"]);
                created++;
                createdList.push(cpa.email);
                console.log(`✅ Created user for CPA: ${cpa.email}`);
            } catch (insertErr: any) {
                console.error(`❌ Failed to create user for CPA ${cpa.email}:`, insertErr.message);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${created} CPA(s) to Users table. Default password: ${DEFAULT_PASSWORD}`,
            created,
            createdEmails: createdList,
            total: cpasToCreate.length
        });
    } catch (err: any) {
        console.error("CPA sync error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}

export async function GET() {
    return POST();
}
