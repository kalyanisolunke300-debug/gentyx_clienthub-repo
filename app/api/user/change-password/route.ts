// app/api/user/change-password/route.ts
import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, currentPassword, newPassword } = body;

        if (!email) {
            return NextResponse.json(
                { success: false, message: "Email is required" },
                { status: 400 }
            );
        }

        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json(
                { success: false, message: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        const pool = await getDbPool();

        // Verify current password if provided
        if (currentPassword) {
            const userResult = await pool
                .request()
                .input("email", sql.NVarChar(255), email)
                .query(`
          SELECT password 
          FROM dbo.Users 
          WHERE email = @email
        `);

            if (userResult.recordset.length === 0) {
                return NextResponse.json(
                    { success: false, message: "User not found" },
                    { status: 404 }
                );
            }

            const storedPassword = userResult.recordset[0].password;

            if (storedPassword !== currentPassword) {
                return NextResponse.json(
                    { success: false, message: "Current password is incorrect" },
                    { status: 401 }
                );
            }
        }

        // Update the password
        const updateResult = await pool
            .request()
            .input("email", sql.NVarChar(255), email)
            .input("password", sql.NVarChar(255), newPassword)
            .query(`
        UPDATE dbo.Users 
        SET password = @password 
        WHERE email = @email
      `);

        if (updateResult.rowsAffected[0] === 0) {
            return NextResponse.json(
                { success: false, message: "User not found in system" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (err: any) {
        console.error("POST /api/user/change-password error:", err);
        return NextResponse.json(
            { success: false, message: err.message || "Failed to update password" },
            { status: 500 }
        );
    }
}
