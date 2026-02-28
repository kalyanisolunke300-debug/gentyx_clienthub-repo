
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const { currentPassword, newEmail, newPassword } = await req.json();

        if (!currentPassword || !newEmail || !newPassword) {
            return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
        }

        const pool = await getDbPool();

        // 1. Get current master admin email (from AdminSettings)
        const adminRes = await pool.query(`SELECT email FROM public."AdminSettings" LIMIT 1`);
        const adminEmail = adminRes.rows[0]?.email;

        if (!adminEmail) {
            return NextResponse.json({ success: false, error: "Master admin profile not found" }, { status: 404 });
        }

        // 2. Verify current password against the Master Admin
        const userRes = await pool.query(
            `SELECT * FROM public."Users" WHERE email = $1 AND role = 'ADMIN'`,
            [adminEmail]
        );

        const currentUser = userRes.rows[0];

        if (!currentUser || currentUser.password !== currentPassword) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 401 });
        }

        // 3. Check if new email already exists in Users
        const checkRes = await pool.query(
            `SELECT id FROM public."Users" WHERE email = $1`,
            [newEmail]
        );

        if (checkRes.rows.length > 0) {
            return NextResponse.json({ success: false, error: "Email already exists in Users" }, { status: 400 });
        }

        // Check if email already exists in AdminSettings
        const checkAdminRes = await pool.query(
            `SELECT id FROM public."AdminSettings" WHERE email = $1`,
            [newEmail]
        );

        if (checkAdminRes.rows.length > 0) {
            return NextResponse.json({ success: false, error: "Email already exists in Admin settings" }, { status: 400 });
        }

        // 4. Create new Admin user
        await pool.query(`
        INSERT INTO public."Users" (email, password, role) 
        VALUES ($1, $2, 'ADMIN')
      `, [newEmail, newPassword]);

        // 5. Add to AdminSettings with notifications enabled by default
        await pool.query(`
        INSERT INTO public."AdminSettings" (full_name, email, phone, role, notifications_enabled)
        VALUES ('New Admin', $1, '', 'Administrator', true)
        `, [newEmail]);

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Create Admin Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
