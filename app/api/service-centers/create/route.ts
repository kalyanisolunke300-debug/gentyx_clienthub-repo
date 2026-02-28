// app/api/service-centers/create/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { sendServiceCenterWelcomeEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Center name is required" }, { status: 400 });
    }

    const pool = await getDbPool();

    // ✅ CHECK FOR DUPLICATE NAME
    const existingCenter = await pool.query(
      `SELECT service_center_id, center_name FROM public."service_centers" WHERE LOWER(center_name) = LOWER($1)`,
      [name.trim()]
    );
    if (existingCenter.rows.length > 0) {
      return NextResponse.json({ success: false, error: `A service center named "${existingCenter.rows[0].center_name}" already exists` }, { status: 409 });
    }

    // ✅ CHECK FOR DUPLICATE EMAIL
    if (email && email.trim()) {
      const existingEmail = await pool.query(`
          SELECT 'client' as entity_type, client_name as name FROM public."Clients" WHERE LOWER(primary_contact_email) = $1
          UNION ALL
          SELECT 'CPA' as entity_type, cpa_name as name FROM public."cpa_centers" WHERE LOWER(email) = $1
          UNION ALL
          SELECT 'service center' as entity_type, center_name as name FROM public."service_centers" WHERE LOWER(email) = $1
        `, [email.trim().toLowerCase()]);
      if (existingEmail.rows.length > 0) {
        const existing = existingEmail.rows[0];
        return NextResponse.json({ success: false, error: `This email is already used by ${existing.entity_type}: "${existing.name}"` }, { status: 409 });
      }
    }

    const maxResult = await pool.query(`SELECT COALESCE(MAX(service_center_id), 0) AS "maxId" FROM public."service_centers"`);
    const nextId = parseInt(maxResult.rows[0].maxId) + 1;
    const centerCode = `SC${String(nextId).padStart(3, "0")}`;

    const insertResult = await pool.query(`
        INSERT INTO public."service_centers" (center_name, email, center_code)
        VALUES ($1, $2, $3)
        RETURNING service_center_id
      `, [name, email, centerCode]);

    const centerId = insertResult.rows[0].service_center_id;

    // Create User entry
    if (email) {
      const existingUser = await pool.query(`SELECT id FROM public."Users" WHERE email = $1`, [email]);
      if (existingUser.rows.length === 0) {
        await pool.query(`INSERT INTO public."Users" (email, password, role) VALUES ($1, $2, $3)`, [email, "ServiceCenter@2025", "SERVICE_CENTER"]);
        console.log(`✅ Created Service Center user credentials for ${email}`);
        try {
          await sendServiceCenterWelcomeEmail(email, name, centerCode);
          console.log(`✅ Welcome email sent to Service Center: ${email}`);
        } catch (emailError) {
          console.error(`⚠️ Failed to send welcome email to Service Center: ${email}`, emailError);
        }
      }
    }

    // Insert Associated Users
    const users = body.users;
    if (Array.isArray(users) && users.length > 0) {
      for (const user of users) {
        if (!user.name || !user.email) continue;
        await pool.query(`
            INSERT INTO public."service_center_users" (service_center_id, user_name, email, role, phone, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [centerId, user.name, user.email, user.role || "User", user.phone || null]);
      }
      console.log(`✅ Added ${users.length} associated users for Service Center: ${name}`);
    }

    return NextResponse.json({ success: true, center_id: centerId, center_code: centerCode, message: "Service Center created successfully" });
  } catch (err: any) {
    console.error("CREATE SERVICE CENTER ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
