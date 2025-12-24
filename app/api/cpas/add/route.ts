import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

const DEFAULT_PASSWORD = "Cpa@12345";

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();

    if (!name) {
      return NextResponse.json(
        { success: false, message: "CPA name is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 1️⃣ Generate Next CPA Code (CPA001, CPA002...)
    const last = await pool.request().query(`
      SELECT TOP 1 cpa_code
      FROM cpa_centers
      ORDER BY cpa_id DESC
    `);

    let nextCode = "CPA001";

    if (last.recordset.length > 0) {
      const lastCode = last.recordset[0].cpa_code;
      const num = parseInt(lastCode.replace("CPA", "")) + 1;
      nextCode = "CPA" + num.toString().padStart(3, "0");
    }

    // 2️⃣ Insert into cpa_centers
    const insertResult = await pool.request()
      .input("code", sql.VarChar, nextCode)
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .query(`
        INSERT INTO cpa_centers (cpa_code, cpa_name, email, created_at, updated_at)
        OUTPUT INSERTED.cpa_id
        VALUES (@code, @name, @email, GETDATE(), GETDATE())
      `);

    const newCpaId = insertResult.recordset[0]?.cpa_id;

    // 3️⃣ Create User entry for CPA login (if email provided)
    if (email) {
      const existingUser = await pool
        .request()
        .input("email", sql.NVarChar(255), email)
        .query(`SELECT id FROM dbo.Users WHERE email = @email`);

      if (existingUser.recordset.length === 0) {
        await pool
          .request()
          .input("email", sql.NVarChar(255), email)
          .input("password", sql.NVarChar(255), DEFAULT_PASSWORD)
          .input("role", sql.NVarChar(50), "CPA")
          .query(`
            INSERT INTO dbo.Users (email, password, role)
            VALUES (@email, @password, @role)
          `);

        console.log(`✅ Created CPA user credentials for ${email}`);
      }
    }

    return NextResponse.json({
      success: true,
      cpa_id: newCpaId,
      cpa_code: nextCode,
      message: `CPA created successfully. Login: ${email} / ${DEFAULT_PASSWORD}`,
    });
  } catch (err: any) {
    console.error("CREATE CPA ERROR:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
