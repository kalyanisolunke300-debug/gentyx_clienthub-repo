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

    // Delete the service center
    await pool.request()
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM dbo.service_centers
        WHERE service_center_id = @id;
      `);

    return NextResponse.json({
      success: true,
      message: "Service Center deleted successfully",
    });

  } catch (err: any) {
    console.error("DELETE SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
