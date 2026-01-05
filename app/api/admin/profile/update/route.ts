
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { full_name, email, phone } = body;

        const pool = await getDbPool();

        // 1. Get current admin email before update
        const currentAdmin = await pool.request().query(`
            SELECT TOP 1 email FROM AdminSettings
        `);
        const oldEmail = currentAdmin.recordset[0]?.email;

        // 2. Update AdminSettings
        await pool.request()
            .input("fullName", full_name)
            .input("email", email)
            .input("phone", phone)
            .query(`
        UPDATE TOP (1) AdminSettings
        SET full_name = @fullName,
            email = @email,
            phone = @phone
      `);

        // 3. Sync email in Users table if changed
        if (oldEmail && oldEmail !== email) {
            await pool.request()
                .input("newEmail", email)
                .input("oldEmail", oldEmail)
                .query(`
          UPDATE Users 
          SET email = @newEmail 
          WHERE email = @oldEmail AND role = 'ADMIN'
        `);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Update Admin Profile Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
