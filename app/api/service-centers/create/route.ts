import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, users } = body;

    const pool = await getDbPool();

    // Generate center code like "sc-1"
    const resultMax = await pool.request().query(`
      SELECT ISNULL(MAX(center_id), 0) AS maxId FROM dbo.service_centers;
    `);

    const nextId = resultMax.recordset[0].maxId + 1;
    const centerCode = `sc-${nextId}`;

    // Insert center
    const insertCenter = await pool.request()
      .input("name", sql.NVarChar, name)
      .input("email", sql.NVarChar, email)
      .input("code", sql.NVarChar, centerCode)
      .query(`
        INSERT INTO dbo.service_centers (center_name, email, center_code)
        OUTPUT INSERTED.center_id
        VALUES (@name, @email, @code);
      `);

    const centerId = insertCenter.recordset[0].center_id;

    // Insert assigned users
    if (users?.length) {
      for (let u of users) {
        await pool.request()
          .input("centerId", sql.Int, centerId)
          .input("name", sql.NVarChar, u.name)
          .input("email", sql.NVarChar, u.email)
          .input("role", sql.NVarChar, u.role)
          .query(`
            INSERT INTO dbo.service_center_users (center_id, user_name, user_email, user_role)
            VALUES (@centerId, @name, @email, @role);
          `);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Service Center created",
      centerId,
      centerCode
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
