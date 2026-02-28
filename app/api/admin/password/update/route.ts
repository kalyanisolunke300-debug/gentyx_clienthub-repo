
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const { currentPassword, newPassword } = await req.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
        }

        const pool = await getDbPool();

        // 1. Get current admin email
        const adminRes = await pool.query(`SELECT email FROM public."AdminSettings" LIMIT 1`);
        const adminEmail = adminRes.rows[0]?.email;

        if (!adminEmail) {
            return NextResponse.json({ success: false, error: "Admin profile not found" }, { status: 404 });
        }

        // 2. Verify current password
        const userRes = await pool.query(
            `SELECT * FROM public."Users" WHERE email = $1 AND role = 'ADMIN'`,
            [adminEmail]
        );

        const user = userRes.rows[0];

        if (!user || user.password !== currentPassword) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 401 });
        }

        // 3. Update password
        await pool.query(
            `UPDATE public."Users" SET password = $1 WHERE email = $2 AND role = 'ADMIN'`,
            [newPassword, adminEmail]
        );

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Update Password Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
