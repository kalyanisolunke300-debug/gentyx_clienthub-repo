
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
        const adminRes = await pool.request().query("SELECT TOP 1 email FROM AdminSettings");
        const adminEmail = adminRes.recordset[0]?.email;

        if (!adminEmail) {
            return NextResponse.json({ success: false, error: "Master admin profile not found" }, { status: 404 });
        }

        // 2. Verify current password against the Master Admin
        const userRes = await pool.request()
            .input("email", adminEmail)
            .query("SELECT * FROM Users WHERE email = @email AND role = 'ADMIN'");

        const currentUser = userRes.recordset[0];

        if (!currentUser || currentUser.password !== currentPassword) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 401 });
        }

        // 3. Check if new email already exists in Users
        const checkRes = await pool.request()
            .input("email", newEmail)
            .query("SELECT id FROM Users WHERE email = @email");

        if (checkRes.recordset.length > 0) {
            return NextResponse.json({ success: false, error: "Email already exists in Users" }, { status: 400 });
        }

        // Check if email already exists in AdminSettings
        const checkAdminRes = await pool.request()
            .input("email", newEmail)
            .query("SELECT id FROM AdminSettings WHERE email = @email");

        if (checkAdminRes.recordset.length > 0) {
            return NextResponse.json({ success: false, error: "Email already exists in Admin settings" }, { status: 400 });
        }

        // 4. Create new Admin user
        await pool.request()
            .input("email", newEmail)
            .input("password", newPassword)
            .query(`
        INSERT INTO Users (email, password, role) 
        VALUES (@email, @password, 'ADMIN')
      `);

        // 5. Add to AdminSettings
        await pool.request()
            .input("email", newEmail)
            .query(`
        INSERT INTO AdminSettings (full_name, email, phone, role)
        VALUES ('New Admin', @email, '', 'Administrator')
        `);

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Create Admin Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
