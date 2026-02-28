// app/api/users/suggestions/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT DISTINCT user_name AS name, email, role, phone
      FROM (
        SELECT user_name, email, role, phone FROM public."client_users"
        UNION
        SELECT user_name, email, role, phone FROM public."service_center_users"
      ) AS combined_users
      WHERE user_name IS NOT NULL AND user_name != ''
      ORDER BY user_name ASC
    `);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err: any) {
    console.error("USERS SUGGESTIONS ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
