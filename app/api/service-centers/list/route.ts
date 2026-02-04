// // /app/api/service-centers/list/route.ts
// import { NextResponse } from "next/server";
// import { getDbPool } from "@/lib/db";

// export async function GET() {
//   try {
//     const pool = await getDbPool();

//     const result = await pool.request().query(`
//       SELECT 
//         service_center_id AS center_id,
//         center_code,
//         center_name,
//         email,
//         created_at,
//         updated_at
//       FROM dbo.service_centers
//       ORDER BY service_center_id DESC
//     `);

//     return NextResponse.json({
//       success: true,
//       data: result.recordset,
//     });

//   } catch (err: any) {
//     console.error("SERVICE CENTER LIST ERROR:", err);
//     return NextResponse.json(
//       { success: false, error: err.message },
//       { status: 500 }
//     );
//   }
// }

// /app/api/service-centers/list/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    // Get service centers with client count
    const centersResult = await pool.request().query(`
    SELECT 
      sc.service_center_id AS center_id,
      sc.center_name,
      sc.center_code,
      sc.email,
      COUNT(c.client_id) AS clients_assigned
    FROM dbo.service_centers sc
    LEFT JOIN dbo.Clients c
      ON c.service_center_id = sc.service_center_id
    GROUP BY 
      sc.service_center_id,
      sc.center_name,
      sc.center_code,
      sc.email
    ORDER BY sc.center_name ASC
    `);

    // Get all associated users for service centers
    const usersResult = await pool.request().query(`
      SELECT 
        id,
        service_center_id,
        user_name AS name,
        email,
        role,
        phone
      FROM dbo.service_center_users
      ORDER BY id ASC
    `);

    // Map users to their service centers
    const usersByCenter: Record<number, any[]> = {};
    for (const user of usersResult.recordset) {
      const centerId = user.service_center_id;
      if (!usersByCenter[centerId]) {
        usersByCenter[centerId] = [];
      }
      usersByCenter[centerId].push({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      });
    }

    // Attach users to each service center
    const centers = centersResult.recordset.map((center: any) => ({
      ...center,
      users: usersByCenter[center.center_id] || [],
    }));

    return NextResponse.json({
      success: true,
      data: centers,
    });

  } catch (err: any) {
    console.error("SERVICE CENTER LIST ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
