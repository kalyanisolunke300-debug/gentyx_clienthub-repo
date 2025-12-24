import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  return handleUpdate(req);
}

export async function PUT(req: Request) {
  return handleUpdate(req);
}

async function handleUpdate(req: Request) {
  try {
    const body = await req.json();
    const { cpa_id, cpa_name, cpa_code, name, email } = body;

    const pool = await getDbPool();

    await pool.request()
      .input("id", sql.Int, cpa_id)
      .input("name", sql.VarChar, cpa_name || name)
      .input("code", sql.VarChar, cpa_code)
      .input("email", sql.VarChar, email)
      .query(`
        UPDATE cpa_centers
        SET cpa_name = COALESCE(@name, cpa_name),
            cpa_code = COALESCE(@code, cpa_code),
            email = COALESCE(@email, email),
            updated_at = GETDATE()
        WHERE cpa_id = @id
      `);

    return NextResponse.json({ success: true, message: "CPA updated successfully" });
  } catch (err: any) {
    console.error("CPA update error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
