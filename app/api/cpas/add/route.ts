import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();
    const pool = await getDbPool();

    // Fetch last CPA code
    const last = await pool.request().query(`
      SELECT TOP 1 cpa_code
      FROM cpa_centers
      ORDER BY cpa_id DESC
    `);

    let nextCode = "CPA001";

    if (last.recordset.length > 0) {
      const lastCode = last.recordset[0].cpa_code; // CPA002
      const num = parseInt(lastCode.replace("CPA", "")) + 1;
      nextCode = "CPA" + num.toString().padStart(3, "0");
    }

    // Insert new CPA
    await pool.request()
      .input("code", sql.VarChar, nextCode)
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .query(`
        INSERT INTO cpa_centers (cpa_code, cpa_name, email, created_at, updated_at)
        VALUES (@code, @name, @email, GETDATE(), GETDATE())
      `);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
