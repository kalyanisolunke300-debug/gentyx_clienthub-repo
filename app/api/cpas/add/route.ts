// app/api/cpas/add/route.ts
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

    // ✅ CHECK FOR DUPLICATE CPA NAME (CASE-INSENSITIVE)
    const existingCpa = await pool
      .request()
      .input("name", sql.VarChar, name.trim())
      .query(`
        SELECT cpa_id, cpa_name 
        FROM cpa_centers 
        WHERE LOWER(cpa_name) = LOWER(@name)
      `);

    if (existingCpa.recordset.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `A CPA named "${existingCpa.recordset[0].cpa_name}" already exists`
        },
        { status: 409 }
      );
    }

    // ✅ CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (if email provided)
    if (email && email.trim()) {
      const existingEmail = await pool
        .request()
        .input("email", sql.VarChar, email.trim().toLowerCase())
        .query(`
          SELECT 'client' as entity_type, client_name as name FROM dbo.clients 
          WHERE LOWER(primary_contact_email) = @email
          UNION ALL
          SELECT 'CPA' as entity_type, cpa_name as name FROM dbo.cpa_centers 
          WHERE LOWER(email) = @email
          UNION ALL
          SELECT 'service center' as entity_type, center_name as name FROM dbo.service_centers 
          WHERE LOWER(email) = @email
        `);

      if (existingEmail.recordset.length > 0) {
        const existing = existingEmail.recordset[0];
        return NextResponse.json(
          {
            success: false,
            message: `This email is already used by ${existing.entity_type}: "${existing.name}"`
          },
          { status: 409 }
        );
      }
    }

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
