import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

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

    const cpaResult = await pool.query(
      `SELECT email, cpa_name FROM public."cpa_centers" WHERE cpa_id = $1`,
      [cpa_id]
    );

    const cpaEmail = cpaResult.rows[0]?.email;
    const cpaName = cpaResult.rows[0]?.cpa_name || "Unknown";

    console.log(`🗑️ Starting deletion of CPA: ${cpaName} (ID: ${cpa_id})`);

    if (cpaEmail) {
      await pool.query(`DELETE FROM public."Users" WHERE email = $1`, [cpaEmail]);
      console.log("  ✓ Deleted user credentials");
    }

    await pool.query(`DELETE FROM public."cpa_centers" WHERE cpa_id = $1`, [cpa_id]);
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
