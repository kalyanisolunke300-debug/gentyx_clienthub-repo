import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing service center ID" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // Delete users associated with this center
    await pool
      .request()
      .input("center_id", sql.Int, id)
      .query(`
        DELETE FROM service_center_users 
        WHERE center_id = @center_id
      `);

    // Delete the service center itself
    await pool
      .request()
      .input("center_id", sql.Int, id)
      .query(`
        DELETE FROM service_centers 
        WHERE center_id = @center_id
      `);

    return NextResponse.json({
      success: true,
      message: "Service center deleted successfully",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
