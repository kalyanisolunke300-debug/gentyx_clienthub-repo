// app/api/clients/update-password/route.ts
import { NextResponse } from "next/server";
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
        const clientResult = await pool.query(`
        SELECT primary_contact_email 
        FROM public."Clients" 
        WHERE client_id = $1
      `, [clientId]);

        if (clientResult.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Client not found" },
                { status: 404 }
            );
        }

        const clientEmail = clientResult.rows[0].primary_contact_email;

        if (!clientEmail) {
            return NextResponse.json(
                { success: false, error: "Client email not found" },
                { status: 400 }
            );
        }

        // Update the password in Users table
        const updateResult = await pool.query(`
        UPDATE public."Users" 
        SET password = $1 
        WHERE email = $2
      `, [newPassword, clientEmail]);

        if (updateResult.rowCount === 0) {
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
