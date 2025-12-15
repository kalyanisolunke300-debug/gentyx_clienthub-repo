// app/api/service-centers/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { center_id, center_name, center_code, email } = body;

    if (!center_id) {
      return NextResponse.json(
        { success: false, error: "center_id is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool.request()
      .input("id", sql.Int, center_id)
      .input("name", sql.NVarChar, center_name)
      .input("code", sql.NVarChar, center_code)
      .input("email", sql.NVarChar, email)
      .query(`
        UPDATE dbo.service_centers
        SET 
          center_name = @name,
          center_code = @code,
          email = @email,
          updated_at = GETDATE()
        WHERE service_center_id = @id;
      `);

    return NextResponse.json({
      success: true,
      message: "Service Center updated successfully",
    });

  } catch (err: any) {
    console.error("UPDATE SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
