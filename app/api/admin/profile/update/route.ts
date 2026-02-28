
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { full_name, email, phone } = body;

        const pool = await getDbPool();

        // 1. Get current admin email before update
        const currentAdmin = await pool.query(`
            SELECT email FROM public."AdminSettings" LIMIT 1
        `);
        const oldEmail = currentAdmin.rows[0]?.email;

        // 2. Update AdminSettings (update first row)
        await pool.query(`
        UPDATE public."AdminSettings"
        SET full_name = $1,
            email = $2,
            phone = $3
        WHERE id = (SELECT id FROM public."AdminSettings" LIMIT 1)
      `, [full_name, email, phone]);

        // 3. Sync email in Users table if changed
        if (oldEmail && oldEmail !== email) {
            await pool.query(`
          UPDATE public."Users" 
          SET email = $1 
          WHERE email = $2 AND role = 'ADMIN'
        `, [email, oldEmail]);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Update Admin Profile Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
