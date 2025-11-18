// /api/cpas/update.ts

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";


export async function PUT(req: Request) {
  try {
    const { cpa_id, name, email } = await req.json();
    const pool = await getDbPool();

    await pool.request()
      .input("id", cpa_id)
      .input("name", name)
      .input("email", email)
      .query(`
        UPDATE dbo.cpa_centers
        SET 
          cpa_name = @name,
          email = @email,
          updated_at = GETDATE()
        WHERE cpa_id = @id
      `);

    return NextResponse.json({ success: true, message: "CPA updated successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
