import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const { cpa_id } = await req.json();

    if (!cpa_id) {
      return NextResponse.json(
        { success: false, error: "CPA ID is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 1. Get CPA email for user credentials deletion
    const cpaResult = await pool.request()
      .input("id", sql.Int, cpa_id)
      .query(`SELECT email, cpa_name FROM cpa_centers WHERE cpa_id = @id`);

    const cpaEmail = cpaResult.recordset[0]?.email;
    const cpaName = cpaResult.recordset[0]?.cpa_name || "Unknown";

    console.log(`🗑️ Starting deletion of CPA: ${cpaName} (ID: ${cpa_id})`);

    // 2. Delete user credentials from Users table
    if (cpaEmail) {
      await pool.request()
        .input("email", sql.NVarChar(255), cpaEmail)
        .query(`DELETE FROM dbo.Users WHERE email = @email`);
      console.log("  ✓ Deleted user credentials");
    }

    // 3. Delete the CPA record
    await pool.request()
      .input("id", sql.Int, cpa_id)
      .query(`DELETE FROM cpa_centers WHERE cpa_id = @id`);
    console.log("  ✓ Deleted CPA record");

    console.log(`✅ Successfully deleted CPA: ${cpaName} (ID: ${cpa_id})`);

    return NextResponse.json({
      success: true,
      message: `CPA "${cpaName}" and credentials deleted successfully`
    });
  } catch (err: any) {
    console.error("DELETE CPA ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
