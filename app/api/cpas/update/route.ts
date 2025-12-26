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

    if (!cpa_id) {
      return NextResponse.json(
        { success: false, message: "CPA ID is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();
    const actualName = cpa_name || name;

    // ✅ CHECK FOR DUPLICATE CPA NAME (CASE-INSENSITIVE, EXCLUDING CURRENT)
    if (actualName) {
      const existingCpa = await pool
        .request()
        .input("name", sql.VarChar, actualName.trim())
        .input("cpaId", sql.Int, cpa_id)
        .query(`
          SELECT cpa_id, cpa_name 
          FROM cpa_centers 
          WHERE LOWER(cpa_name) = LOWER(@name)
          AND cpa_id != @cpaId
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
    }

    // ✅ CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (EXCLUDING CURRENT CPA)
    if (email && email.trim()) {
      const existingEmail = await pool
        .request()
        .input("email", sql.VarChar, email.trim().toLowerCase())
        .input("cpaId", sql.Int, cpa_id)
        .query(`
          SELECT 'client' as entity_type, client_name as name FROM dbo.clients 
          WHERE LOWER(primary_contact_email) = @email
          UNION ALL
          SELECT 'CPA' as entity_type, cpa_name as name FROM dbo.cpa_centers 
          WHERE LOWER(email) = @email AND cpa_id != @cpaId
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

    // 📧 GET OLD EMAIL BEFORE UPDATE (for syncing Users table)
    const oldEmailResult = await pool.request()
      .input("cpaId", sql.Int, cpa_id)
      .query(`SELECT email FROM cpa_centers WHERE cpa_id = @cpaId`);
    const oldEmail = oldEmailResult.recordset[0]?.email;

    // Update cpa_centers table
    await pool.request()
      .input("id", sql.Int, cpa_id)
      .input("name", sql.VarChar, actualName)
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

    // 📧 SYNC EMAIL TO USERS TABLE (for login credentials)
    if (email && email.trim() && oldEmail && email.toLowerCase() !== oldEmail.toLowerCase()) {
      await pool.request()
        .input("oldEmail", sql.NVarChar(255), oldEmail)
        .input("newEmail", sql.NVarChar(255), email)
        .query(`
          UPDATE dbo.Users 
          SET email = @newEmail 
          WHERE email = @oldEmail AND role = 'CPA'
        `);
      console.log(`✅ CPA login email updated from ${oldEmail} to ${email}`);
    }

    return NextResponse.json({ success: true, message: "CPA updated successfully" });
  } catch (err: any) {
    console.error("CPA update error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
