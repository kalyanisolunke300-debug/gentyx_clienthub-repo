// app/api/clients/archive/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientId, archive } = body;

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "Client ID is required" },
                { status: 400 }
            );
        }

        const isArchived = archive === true;

        const pool = await getDbPool();

        // Get client info for logging
        const clientResult = await pool.query(
            `SELECT client_name FROM public."Clients" WHERE client_id = $1`,
            [clientId]
        );

        const clientName = clientResult.rows[0]?.client_name || "Unknown";

        // Update the is_archived flag
        await pool.query(`
                UPDATE public."Clients" 
                SET is_archived = $1, 
                    updated_at = NOW()
                WHERE client_id = $2
            `, [isArchived, clientId]);

        const action = isArchived ? "archived" : "restored";
        console.log(`✅ Client "${clientName}" (ID: ${clientId}) has been ${action}`);

        return NextResponse.json({
            success: true,
            message: `Client "${clientName}" has been ${action} successfully.`,
            clientId,
            clientName,
            isArchived,
        });

    } catch (error: any) {
        console.error("Archive client error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to archive client" },
            { status: 500 }
        );
    }
}
