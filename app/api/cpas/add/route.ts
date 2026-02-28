// app/api/cpas/add/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { sendCpaWelcomeEmail } from "@/lib/email";

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
    const existingCpa = await pool.query(`
        SELECT cpa_id, cpa_name 
        FROM public."cpa_centers" 
        WHERE LOWER(cpa_name) = LOWER($1)
      `, [name.trim()]);

    if (existingCpa.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `A CPA named "${existingCpa.rows[0].cpa_name}" already exists`
        },
        { status: 409 }
      );
    }

    // ✅ CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (if email provided)
    if (email && email.trim()) {
      const existingEmail = await pool.query(`
          SELECT 'client' as entity_type, client_name as name FROM public."Clients" 
          WHERE LOWER(primary_contact_email) = $1
          UNION ALL
          SELECT 'CPA' as entity_type, cpa_name as name FROM public."cpa_centers" 
          WHERE LOWER(email) = $1
          UNION ALL
          SELECT 'service center' as entity_type, center_name as name FROM public."service_centers" 
          WHERE LOWER(email) = $1
        `, [email.trim().toLowerCase()]);

      if (existingEmail.rows.length > 0) {
        const existing = existingEmail.rows[0];
        return NextResponse.json(
          {
            success: false,
            message: `This email is already used by ${existing.entity_type}: "${existing.name}"`
          },
          { status: 409 }
        );
      }
    }

    const last = await pool.query(`
      SELECT cpa_code
      FROM public."cpa_centers"
      ORDER BY cpa_id DESC
      LIMIT 1
    `);

    let nextCode = "CPA001";

    if (last.rows.length > 0) {
      const lastCode = last.rows[0].cpa_code;
      const num = parseInt(lastCode.replace("CPA", "")) + 1;
      nextCode = "CPA" + num.toString().padStart(3, "0");
    }

    // 2️⃣ Insert into cpa_centers
    const insertResult = await pool.query(`
        INSERT INTO public."cpa_centers" (cpa_code, cpa_name, email, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING cpa_id
      `, [nextCode, name, email]);

    const newCpaId = insertResult.rows[0]?.cpa_id;

    // 3️⃣ Create User entry for CPA login (if email provided)
    if (email) {
      const existingUser = await pool.query(
        `SELECT id FROM public."Users" WHERE email = $1`,
        [email]
      );

      if (existingUser.rows.length === 0) {
        await pool.query(`
            INSERT INTO public."Users" (email, password, role)
            VALUES ($1, $2, $3)
          `, [email, DEFAULT_PASSWORD, "CPA"]);

        console.log(`✅ Created CPA user credentials for ${email}`);

        // 📧 Send welcome email to the CPA
        try {
          await sendCpaWelcomeEmail(email, name, nextCode);
          console.log(`✅ Welcome email sent to CPA: ${email}`);
        } catch (emailError) {
          console.error(`⚠️ Failed to send welcome email to CPA: ${email}`, emailError);
        }
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
