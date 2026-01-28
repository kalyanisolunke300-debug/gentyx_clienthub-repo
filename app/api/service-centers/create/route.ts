// app/api/service-centers/create/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { sendServiceCenterWelcomeEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Center name is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ✅ CHECK FOR DUPLICATE SERVICE CENTER NAME (CASE-INSENSITIVE)
    const existingCenter = await pool
      .request()
      .input("name", sql.NVarChar, name.trim())
      .query(`
        SELECT service_center_id, center_name 
        FROM dbo.service_centers 
        WHERE LOWER(center_name) = LOWER(@name)
      `);

    if (existingCenter.recordset.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `A service center named "${existingCenter.recordset[0].center_name}" already exists`
        },
        { status: 409 }
      );
    }

    // ✅ CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (if email provided)
    if (email && email.trim()) {
      const existingEmail = await pool
        .request()
        .input("email", sql.NVarChar, email.trim().toLowerCase())
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
            error: `This email is already used by ${existing.entity_type}: "${existing.name}"`
          },
          { status: 409 }
        );
      }
    }

    const maxResult = await pool.request().query(`
      SELECT ISNULL(MAX(service_center_id), 0) AS maxId
      FROM dbo.service_centers;
    `);

    const nextId = maxResult.recordset[0].maxId + 1;
    const centerCode = `SC${String(nextId).padStart(3, "0")}`;

    // 2️⃣ Insert into service_centers
    const insertResult = await pool.request()
      .input("name", sql.NVarChar, name)
      .input("email", sql.NVarChar, email)
      .input("code", sql.NVarChar, centerCode)
      .query(`
        INSERT INTO dbo.service_centers (center_name, email, center_code)
        OUTPUT INSERTED.service_center_id
        VALUES (@name, @email, @code)
      `);

    const centerId = insertResult.recordset[0].service_center_id;

    // 3️⃣ Create User entry for Service Center login (if email provided)
    if (email) {
      const existingUser = await pool
        .request()
        .input("email", sql.NVarChar(255), email)
        .query(`SELECT id FROM dbo.Users WHERE email = @email`);

      if (existingUser.recordset.length === 0) {
        await pool
          .request()
          .input("email", sql.NVarChar(255), email)
          .input("password", sql.NVarChar(255), "ServiceCenter@2025")
          .input("role", sql.NVarChar(50), "SERVICE_CENTER")
          .query(`
            INSERT INTO dbo.Users (email, password, role)
            VALUES (@email, @password, @role)
          `);

        console.log(`✅ Created Service Center user credentials for ${email}`);

        // 📧 Send welcome email to the Service Center
        try {
          await sendServiceCenterWelcomeEmail(email, name, centerCode);
          console.log(`✅ Welcome email sent to Service Center: ${email}`);
        } catch (emailError) {
          console.error(`⚠️ Failed to send welcome email to Service Center: ${email}`, emailError);
          // Don't fail the entire request if email fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      center_id: centerId,
      center_code: centerCode,
      message: "Service Center created successfully",
    });

  } catch (err: any) {
    console.error("CREATE SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
