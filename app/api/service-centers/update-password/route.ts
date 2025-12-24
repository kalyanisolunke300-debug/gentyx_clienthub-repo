// app/api/service-centers/update-password/route.ts
import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { serviceCenterId, newPassword } = body;

        if (!serviceCenterId) {
            return NextResponse.json(
                { success: false, error: "Missing serviceCenterId" },
                { status: 400 }
            );
        }

        if (!newPassword || newPassword.length < 8) {
            return NextResponse.json(
                { success: false, error: "Password must be at least 8 characters" },
                { status: 400 }
            );
        }

        const pool = await getDbPool();

        // Get the service center's email
        const scResult = await pool
            .request()
            .input("serviceCenterId", sql.Int, serviceCenterId)
            .query(`
        SELECT email 
        FROM dbo.service_centers 
        WHERE service_center_id = @serviceCenterId
      `);

        if (scResult.recordset.length === 0) {
            return NextResponse.json(
                { success: false, error: "Service Center not found" },
                { status: 404 }
            );
        }

        const email = scResult.recordset[0].email;

        if (!email) {
            return NextResponse.json(
                { success: false, error: "Service Center email not found" },
                { status: 400 }
            );
        }

        // Update the password in Users table
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
                { success: false, error: "User not found in system" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (err: any) {
        console.error("POST /api/service-centers/update-password error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update password" },
            { status: 500 }
        );
    }
}
