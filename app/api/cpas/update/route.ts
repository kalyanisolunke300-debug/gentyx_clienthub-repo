import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { sendUpdateNotification } from "@/lib/email";

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

    // ✅ CHECK FOR DUPLICATE CPA NAME
    if (actualName) {
      const existingCpa = await pool.query(`
          SELECT cpa_id, cpa_name 
          FROM public."cpa_centers" 
          WHERE LOWER(cpa_name) = LOWER($1)
          AND cpa_id != $2
        `, [actualName.trim(), cpa_id]);

      if (existingCpa.rows.length > 0) {
        return NextResponse.json(
          { success: false, message: `A CPA named "${existingCpa.rows[0].cpa_name}" already exists` },
          { status: 409 }
        );
      }
    }

    // ✅ CHECK FOR DUPLICATE EMAIL
    if (email && email.trim()) {
      const existingEmail = await pool.query(`
          SELECT 'client' as entity_type, client_name as name FROM public."Clients" 
          WHERE LOWER(primary_contact_email) = $1
          UNION ALL
          SELECT 'CPA' as entity_type, cpa_name as name FROM public."cpa_centers" 
          WHERE LOWER(email) = $1 AND cpa_id != $2
          UNION ALL
          SELECT 'service center' as entity_type, center_name as name FROM public."service_centers" 
          WHERE LOWER(email) = $1
        `, [email.trim().toLowerCase(), cpa_id]);

      if (existingEmail.rows.length > 0) {
        const existing = existingEmail.rows[0];
        return NextResponse.json(
          { success: false, message: `This email is already used by ${existing.entity_type}: "${existing.name}"` },
          { status: 409 }
        );
      }
    }

    // 📧 GET OLD EMAIL BEFORE UPDATE
    const oldEmailResult = await pool.query(
      `SELECT email FROM public."cpa_centers" WHERE cpa_id = $1`,
      [cpa_id]
    );
    const oldEmail = oldEmailResult.rows[0]?.email;

    // Update cpa_centers table
    await pool.query(`
        UPDATE public."cpa_centers"
        SET cpa_name = COALESCE($1, cpa_name),
            cpa_code = COALESCE($2, cpa_code),
            email = COALESCE($3, email),
            updated_at = NOW()
        WHERE cpa_id = $4
      `, [actualName, cpa_code, email, cpa_id]);

    // 📧 SYNC EMAIL TO USERS TABLE
    if (email && email.trim() && oldEmail && email.toLowerCase() !== oldEmail.toLowerCase()) {
      await pool.query(`
          UPDATE public."Users" 
          SET email = $1 
          WHERE email = $2 AND role = 'CPA'
        `, [email, oldEmail]);
      console.log(`✅ CPA login email updated from ${oldEmail} to ${email}`);
    }

    // 📧 Send notification
    if (email) {
      try {
        await sendUpdateNotification({
          recipientEmail: email,
          recipientName: actualName,
          updateType: 'profile_updated',
          details: {
            title: 'Your CPA Profile Has Been Updated',
            description: `Your CPA profile "${actualName}" has been updated by the administrator.`,
            actionUrl: 'https://legacy.hubonesystems.net/login',
            actionLabel: 'View Your Profile',
          },
        });
      } catch (emailError) {
        console.error(`⚠️ Failed to send notification to CPA: ${email}`, emailError);
      }
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
