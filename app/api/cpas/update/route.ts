import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const { cpa_id, name, email } = await req.json();
    const pool = await getDbPool();


    await pool.request()
      .input("id", sql.Int, cpa_id)
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .query(`
        UPDATE cpa_centers
        SET cpa_name = @name,
            email = @email,
            updated_at = GETDATE()
        WHERE cpa_id = @id
      `);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
