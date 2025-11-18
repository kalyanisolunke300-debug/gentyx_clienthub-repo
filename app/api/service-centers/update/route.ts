import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    const pool = await getDbPool();
    const body = await req.json();

    // Correct field names from frontend/Postman
    const { 
      center_id, 
      center_name, 
      center_code, 
      email, 
      users 
    } = body;

    if (!center_id) {
      return NextResponse.json(
        { success: false, error: "center_id is required" },
        { status: 400 }
      );
    }

    // UPDATE MAIN CENTER TABLE
    await pool.request()
      .input("center_id", sql.Int, center_id)
      .input("center_name", sql.NVarChar, center_name)
      .input("center_code", sql.NVarChar, center_code)
      .input("email", sql.NVarChar, email)
      .query(`
        UPDATE service_centers
        SET center_name = @center_name,
            center_code = @center_code,
            email = @email,
            updated_at = GETDATE()
        WHERE center_id = @center_id
      `);

    // DELETE OLD USERS
    await pool.request()
      .input("center_id", sql.Int, center_id)
      .query(`DELETE FROM service_center_users WHERE center_id = @center_id`);

    // INSERT NEW USERS
    if (Array.isArray(users)) {
      for (const u of users) {
        await pool.request()
          .input("center_id", sql.Int, center_id)
          .input("user_name", sql.NVarChar, u.user_name || u.name)
          .input("user_email", sql.NVarChar, u.user_email || u.email)
          .input("user_role", sql.NVarChar, u.user_role || u.role)
          .query(`
            INSERT INTO service_center_users 
            (center_id, user_name, user_email, user_role)
            VALUES (@center_id, @user_name, @user_email, @user_role)
          `);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Service Center updated successfully",
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
