// app/api/service-centers/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { sendUpdateNotification } from "@/lib/email";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { center_id, center_name, center_code, email } = body;

    if (!center_id) {
      return NextResponse.json({ success: false, error: "center_id is required" }, { status: 400 });
    }

    const pool = await getDbPool();

    // ✅ CHECK FOR DUPLICATE NAME
    if (center_name) {
      const existingCenter = await pool.query(
        `SELECT service_center_id, center_name FROM public."service_centers" WHERE LOWER(center_name) = LOWER($1) AND service_center_id != $2`,
        [center_name.trim(), center_id]
      );
      if (existingCenter.rows.length > 0) {
        return NextResponse.json({ success: false, error: `A service center named "${existingCenter.rows[0].center_name}" already exists` }, { status: 409 });
      }
    }

    // ✅ CHECK FOR DUPLICATE EMAIL
    if (email && email.trim()) {
      const existingEmail = await pool.query(`
          SELECT 'client' as entity_type, client_name as name FROM public."Clients" WHERE LOWER(primary_contact_email) = $1
          UNION ALL
          SELECT 'CPA' as entity_type, cpa_name as name FROM public."cpa_centers" WHERE LOWER(email) = $1
          UNION ALL
          SELECT 'service center' as entity_type, center_name as name FROM public."service_centers" WHERE LOWER(email) = $1 AND service_center_id != $2
        `, [email.trim().toLowerCase(), center_id]);
      if (existingEmail.rows.length > 0) {
        const existing = existingEmail.rows[0];
        return NextResponse.json({ success: false, error: `This email is already used by ${existing.entity_type}: "${existing.name}"` }, { status: 409 });
      }
    }

    // GET OLD EMAIL
    const oldEmailResult = await pool.query(`SELECT email FROM public."service_centers" WHERE service_center_id = $1`, [center_id]);
    const oldEmail = oldEmailResult.rows[0]?.email;

    await pool.query(`
        UPDATE public."service_centers"
        SET center_name = $1, center_code = $2, email = $3, updated_at = NOW()
        WHERE service_center_id = $4
      `, [center_name, center_code, email, center_id]);

    // SYNC EMAIL TO USERS TABLE
    if (email && email.trim() && oldEmail && email.toLowerCase() !== oldEmail.toLowerCase()) {
      await pool.query(`UPDATE public."Users" SET email = $1 WHERE email = $2 AND role = 'SERVICE_CENTER'`, [email, oldEmail]);
      console.log(`✅ Service Center login email updated from ${oldEmail} to ${email}`);
    }

    // Send notification
    if (email) {
      try {
        await sendUpdateNotification({
          recipientEmail: email, recipientName: center_name, updateType: 'profile_updated',
          details: { title: 'Your Service Center Profile Has Been Updated', description: `Your Service Center profile "${center_name}" has been updated.`, actionUrl: 'https://legacy.hubonesystems.net/login', actionLabel: 'View Your Profile' },
        });
      } catch (emailError) {
        console.error(`⚠️ Failed to send notification to Service Center: ${email}`, emailError);
      }
    }

    // Update Associated Users
    const users = body.users;
    if (Array.isArray(users)) {
      await pool.query(`DELETE FROM public."service_center_users" WHERE service_center_id = $1`, [center_id]);
      for (const user of users) {
        if (!user.name || !user.email) continue;
        await pool.query(`
            INSERT INTO public."service_center_users" (service_center_id, user_name, email, role, phone, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [center_id, user.name, user.email, user.role || "User", user.phone || null]);
      }
      console.log(`✅ Updated associated users for Service Center ID: ${center_id}`);
    }

    return NextResponse.json({ success: true, message: "Service Center updated successfully" });
  } catch (err: any) {
    console.error("UPDATE SERVICE CENTER ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
