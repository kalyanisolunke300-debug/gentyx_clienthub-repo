// app/api/service-centers/delete/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 1. Get service center email for user credentials deletion
    const scResult = await pool.request()
      .input("id", sql.Int, id)
      .query(`SELECT email, center_name FROM dbo.service_centers WHERE service_center_id = @id`);

    const scEmail = scResult.recordset[0]?.email;
    const scName = scResult.recordset[0]?.center_name || "Unknown";

    console.log(`🗑️ Starting deletion of Service Center: ${scName} (ID: ${id})`);

    // 2. Delete user credentials from Users table
    if (scEmail) {
      await pool.request()
        .input("email", sql.NVarChar(255), scEmail)
        .query(`DELETE FROM dbo.Users WHERE email = @email`);
      console.log("  ✓ Deleted user credentials");
    }

    // 3. Delete the service center record
    await pool.request()
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM dbo.service_centers
        WHERE service_center_id = @id;
      `);
    console.log("  ✓ Deleted service center record");

    console.log(`✅ Successfully deleted Service Center: ${scName} (ID: ${id})`);

    return NextResponse.json({
      success: true,
      message: `Service Center "${scName}" and credentials deleted successfully`,
    });

  } catch (err: any) {
    console.error("DELETE SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
