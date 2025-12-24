// app/api/cpas/sync-users/route.ts
// This endpoint syncs all existing CPAs to the Users table
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

const DEFAULT_PASSWORD = "Cpa@12345";

export async function POST() {
    try {
        const pool = await getDbPool();

        // Get all CPAs that don't have a user account yet
        const cpasWithoutUsers = await pool.request().query(`
      SELECT c.cpa_id, c.cpa_name, c.email
      FROM cpa_centers c
      WHERE c.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM dbo.Users u WHERE u.email = c.email
        )
    `);

        const cpasToCreate = cpasWithoutUsers.recordset;
        let created = 0;
        const createdList: string[] = [];

        for (const cpa of cpasToCreate) {
            try {
                await pool
                    .request()
                    .input("email", sql.NVarChar(255), cpa.email)
                    .input("password", sql.NVarChar(255), DEFAULT_PASSWORD)
                    .input("role", sql.NVarChar(50), "CPA")
                    .query(`
            INSERT INTO dbo.Users (email, password, role)
            VALUES (@email, @password, @role)
          `);
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
        return NextResponse.json(
            { success: false, message: err.message },
            { status: 500 }
        );
    }
}

// Also allow GET for easy testing
export async function GET() {
    return POST();
}
