
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
        const adminRes = await pool.request().query("SELECT TOP 1 email FROM AdminSettings");
        const adminEmail = adminRes.recordset[0]?.email;

        if (!adminEmail) {
            return NextResponse.json({ success: false, error: "Admin profile not found" }, { status: 404 });
        }

        // 2. Verify current password
        const userRes = await pool.request()
            .input("email", adminEmail)
            .query("SELECT * FROM Users WHERE email = @email AND role = 'ADMIN'");

        const user = userRes.recordset[0];

        if (!user || user.password !== currentPassword) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 401 });
        }

        // 3. Update password
        await pool.request()
            .input("password", newPassword)
            .input("email", adminEmail)
            .query("UPDATE Users SET password = @password WHERE email = @email AND role = 'ADMIN'");

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Update Password Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
