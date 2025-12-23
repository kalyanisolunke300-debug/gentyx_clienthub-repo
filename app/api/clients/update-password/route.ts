// app/api/clients/update-password/route.ts
import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientId, newPassword } = body;

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "Missing clientId" },
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

        // Get the client's email first
        const clientResult = await pool
            .request()
            .input("clientId", sql.Int, clientId)
            .query(`
        SELECT primary_contact_email 
        FROM dbo.clients 
        WHERE client_id = @clientId
      `);

        if (clientResult.recordset.length === 0) {
            return NextResponse.json(
                { success: false, error: "Client not found" },
                { status: 404 }
            );
        }

        const clientEmail = clientResult.recordset[0].primary_contact_email;

        if (!clientEmail) {
            return NextResponse.json(
                { success: false, error: "Client email not found" },
                { status: 400 }
            );
        }

        // Update the password in Users table
        const updateResult = await pool
            .request()
            .input("email", sql.NVarChar(255), clientEmail)
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
        console.error("POST /api/clients/update-password error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update password" },
            { status: 500 }
        );
    }
}
