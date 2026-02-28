// app/api/service-centers/delete/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const pool = await getDbPool();

    const scResult = await pool.query(
      `SELECT email, center_name FROM public."service_centers" WHERE service_center_id = $1`,
      [id]
    );

    const scEmail = scResult.rows[0]?.email;
    const scName = scResult.rows[0]?.center_name || "Unknown";

    console.log(`🗑️ Starting deletion of Service Center: ${scName} (ID: ${id})`);

    if (scEmail) {
      await pool.query(`DELETE FROM public."Users" WHERE email = $1`, [scEmail]);
      console.log("  ✓ Deleted user credentials");
    }

    await pool.query(`DELETE FROM public."service_centers" WHERE service_center_id = $1`, [id]);
    console.log("  ✓ Deleted service center record");

    console.log(`✅ Successfully deleted Service Center: ${scName} (ID: ${id})`);

    return NextResponse.json({ success: true, message: `Service Center "${scName}" and credentials deleted successfully` });
  } catch (err: any) {
    console.error("DELETE SERVICE CENTER ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
