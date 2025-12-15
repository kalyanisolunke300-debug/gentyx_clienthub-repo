import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const { cpa_id } = await req.json();
    const pool = await getDbPool();

    await pool.request()
      .input("id", sql.Int, cpa_id)
      .query(`DELETE FROM cpa_centers WHERE cpa_id = @id`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
