// app/api/users/suggestions/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

/**
 * GET /api/users/suggestions
 * Returns unique users from client_users and service_center_users tables
 * for autocomplete suggestions
 */
export async function GET() {
    try {
        const pool = await getDbPool();

        // Get unique users from both client_users and service_center_users
        const result = await pool.request().query(`
      SELECT DISTINCT 
        user_name AS name,
        email,
        role,
        phone
      FROM (
        SELECT user_name, email, role, phone FROM dbo.client_users
        UNION
        SELECT user_name, email, role, phone FROM dbo.service_center_users
      ) AS combined_users
      WHERE user_name IS NOT NULL AND user_name != ''
      ORDER BY user_name ASC
    `);

        return NextResponse.json({
            success: true,
            data: result.recordset,
        });

    } catch (err: any) {
        console.error("USERS SUGGESTIONS ERROR:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
