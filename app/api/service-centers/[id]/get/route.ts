// app/api/service-centers/[id]/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request, { params }: any) {
  try {
    const id = Number(params.id);
    const pool = await getDbPool();

    const center = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          service_center_id AS id, 
          center_name AS name, 
          center_code AS code,
          email,
          created_at,
          updated_at
        FROM dbo.service_centers
        WHERE service_center_id = @id;
      `);

    const users = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT
          id,
          user_name AS name,
          user_email AS email,
          user_role AS role
        FROM dbo.service_center_users
        WHERE center_id = @id;
      `);

    return NextResponse.json({
      success: true,
      data: {
        ...center.recordset[0],
        users: users.recordset
      }
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}