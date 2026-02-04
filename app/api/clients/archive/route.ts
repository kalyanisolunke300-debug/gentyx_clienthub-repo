// app/api/clients/archive/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

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

        // archive should be true to archive, false to unarchive (restore)
        const isArchived = archive === true ? 1 : 0;

        const pool = await getDbPool();

        // Get client info for logging
        const clientResult = await pool.request()
            .input("clientId", sql.Int, clientId)
            .query(`SELECT client_name FROM dbo.Clients WHERE client_id = @clientId`);

        const clientName = clientResult.recordset[0]?.client_name || "Unknown";

        // Update the is_archived flag
        await pool.request()
            .input("clientId", sql.Int, clientId)
            .input("isArchived", sql.Bit, isArchived)
            .query(`
                UPDATE dbo.Clients 
                SET is_archived = @isArchived, 
                    updated_at = GETDATE()
                WHERE client_id = @clientId
            `);

        const action = isArchived ? "archived" : "restored";
        console.log(`✅ Client "${clientName}" (ID: ${clientId}) has been ${action}`);

        return NextResponse.json({
            success: true,
            message: `Client "${clientName}" has been ${action} successfully.`,
            clientId,
            clientName,
            isArchived: isArchived === 1,
        });

    } catch (error: any) {
        console.error("Archive client error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to archive client" },
            { status: 500 }
        );
    }
}
