// /app/api/service-centers/list/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    const centersResult = await pool.query(`
    SELECT 
      sc.service_center_id AS center_id,
      sc.center_name,
      sc.center_code,
      sc.email,
      COUNT(c.client_id) AS clients_assigned
    FROM public."service_centers" sc
    LEFT JOIN public."Clients" c ON c.service_center_id = sc.service_center_id
    GROUP BY sc.service_center_id, sc.center_name, sc.center_code, sc.email
    ORDER BY sc.center_name ASC
    `);

    const usersResult = await pool.query(`
      SELECT id, service_center_id, user_name AS name, email, role, phone
      FROM public."service_center_users"
      ORDER BY id ASC
    `);

    const usersByCenter: Record<number, any[]> = {};
    for (const user of usersResult.rows) {
      const centerId = user.service_center_id;
      if (!usersByCenter[centerId]) usersByCenter[centerId] = [];
      usersByCenter[centerId].push({ id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone });
    }

    const centers = centersResult.rows.map((center: any) => ({
      ...center,
      users: usersByCenter[center.center_id] || [],
    }));

    return NextResponse.json({ success: true, data: centers });
  } catch (err: any) {
    console.error("SERVICE CENTER LIST ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
