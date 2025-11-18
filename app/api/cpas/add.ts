// app/api/cpas/add.ts

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();
    const pool = await getDbPool();

    // Get last CPA code
    const last = await pool.request().query(`
      SELECT TOP 1 cpa_code 
      FROM dbo.cpa_centers
      ORDER BY cpa_id DESC
    `);

    let nextCode = "CPA001";
    if (last.recordset.length > 0) {
      const lastCode = last.recordset[0].cpa_code; // example: CPA005
      const num = parseInt(lastCode.replace("CPA", "")) + 1;
      nextCode = "CPA" + num.toString().padStart(3, "0");
    }

    // Insert CPA
    await pool.request()
      .input("code", nextCode)
      .input("name", name)
      .input("email", email)
      .query(`
        INSERT INTO dbo.cpa_centers (cpa_code, cpa_name, email, created_at, updated_at)
        VALUES (@code, @name, @email, GETDATE(), GETDATE())
      `);

    return NextResponse.json({ success: true, message: "CPA created successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
