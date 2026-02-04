// app/api/service-centers/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { sendUpdateNotification } from "@/lib/email";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { center_id, center_name, center_code, email } = body;

    if (!center_id) {
      return NextResponse.json(
        { success: false, error: "center_id is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ✅ CHECK FOR DUPLICATE SERVICE CENTER NAME (CASE-INSENSITIVE, EXCLUDING CURRENT)
    if (center_name) {
      const existingCenter = await pool
        .request()
        .input("name", sql.NVarChar, center_name.trim())
        .input("centerId", sql.Int, center_id)
        .query(`
          SELECT service_center_id, center_name 
          FROM dbo.service_centers 
          WHERE LOWER(center_name) = LOWER(@name)
          AND service_center_id != @centerId
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
    }

    // ✅ CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (EXCLUDING CURRENT SERVICE CENTER)
    if (email && email.trim()) {
      const existingEmail = await pool
        .request()
        .input("email", sql.NVarChar, email.trim().toLowerCase())
        .input("centerId", sql.Int, center_id)
        .query(`
          SELECT 'client' as entity_type, client_name as name FROM dbo.clients 
          WHERE LOWER(primary_contact_email) = @email
          UNION ALL
          SELECT 'CPA' as entity_type, cpa_name as name FROM dbo.cpa_centers 
          WHERE LOWER(email) = @email
          UNION ALL
          SELECT 'service center' as entity_type, center_name as name FROM dbo.service_centers 
          WHERE LOWER(email) = @email AND service_center_id != @centerId
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

    // 📧 GET OLD EMAIL BEFORE UPDATE (for syncing Users table)
    const oldEmailResult = await pool.request()
      .input("centerId", sql.Int, center_id)
      .query(`SELECT email FROM dbo.service_centers WHERE service_center_id = @centerId`);
    const oldEmail = oldEmailResult.recordset[0]?.email;

    const result = await pool.request()
      .input("id", sql.Int, center_id)
      .input("name", sql.NVarChar, center_name)
      .input("code", sql.NVarChar, center_code)
      .input("email", sql.NVarChar, email)
      .query(`
        UPDATE dbo.service_centers
        SET 
          center_name = @name,
          center_code = @code,
          email = @email,
          updated_at = GETDATE()
        WHERE service_center_id = @id;
      `);

    // 📧 SYNC EMAIL TO USERS TABLE (for login credentials)
    if (email && email.trim() && oldEmail && email.toLowerCase() !== oldEmail.toLowerCase()) {
      await pool.request()
        .input("oldEmail", sql.NVarChar(255), oldEmail)
        .input("newEmail", sql.NVarChar(255), email)
        .query(`
          UPDATE dbo.Users 
          SET email = @newEmail 
          WHERE email = @oldEmail AND role = 'SERVICE_CENTER'
        `);
      console.log(`✅ Service Center login email updated from ${oldEmail} to ${email}`);
    }

    // 📧 Send profile update notification email to Service Center
    if (email) {
      try {
        await sendUpdateNotification({
          recipientEmail: email,
          recipientName: center_name,
          updateType: 'profile_updated',
          details: {
            title: 'Your Service Center Profile Has Been Updated',
            description: `Your Service Center profile "${center_name}" has been updated by the administrator. If you did not expect this change, please contact support.`,
            actionUrl: 'https://legacy.hubonesystems.net/login',
            actionLabel: 'View Your Profile',
          },
        });
        console.log(`✅ Profile update notification sent to Service Center: ${email}`);
      } catch (emailError) {
        console.error(`⚠️ Failed to send profile update notification to Service Center: ${email}`, emailError);
      }
    }

    // 5️⃣ Update Associated Users (if provided)
    const users = body.users;
    if (Array.isArray(users)) {
      // Delete existing associated users for this service center
      await pool
        .request()
        .input("centerId", sql.Int, center_id)
        .query(`DELETE FROM dbo.service_center_users WHERE service_center_id = @centerId`);

      // Insert new associated users
      for (const user of users) {
        if (!user.name || !user.email) continue;

        await pool
          .request()
          .input("serviceCenterId", sql.Int, center_id)
          .input("userName", sql.NVarChar(255), user.name)
          .input("userEmail", sql.NVarChar(255), user.email)
          .input("userRole", sql.NVarChar(100), user.role || "User")
          .input("phone", sql.NVarChar(50), user.phone || null)
          .query(`
            INSERT INTO dbo.service_center_users (
              service_center_id,
              user_name,
              email,
              role,
              phone,
              created_at
            )
            VALUES (
              @serviceCenterId,
              @userName,
              @userEmail,
              @userRole,
              @phone,
              GETDATE()
            )
          `);
      }
      console.log(`✅ Updated associated users for Service Center ID: ${center_id}`);
    }

    return NextResponse.json({
      success: true,
      message: "Service Center updated successfully",
    });

  } catch (err: any) {
    console.error("UPDATE SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
