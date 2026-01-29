// app/api/clients/delete/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientId } = body;

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "Client ID is required" },
                { status: 400 }
            );
        }

        const pool = await getDbPool();

        // Start a transaction to ensure all deletions happen atomically
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Get client info before deletion for logging
            const clientResult = await transaction.request()
                .input("clientId", clientId)
                .query(`SELECT client_name FROM dbo.Clients WHERE client_id = @clientId`);

            const clientName = clientResult.recordset[0]?.client_name || "Unknown";

            console.log(`🗑️ Starting deletion of client: ${clientName} (ID: ${clientId})`);

            // 1. Delete messages related to this client
            await transaction.request()
                .input("clientId", clientId)
                .query(`DELETE FROM dbo.onboarding_messages WHERE client_id = @clientId`);
            console.log("  ✓ Deleted messages");

            // 2. Delete tasks related to this client
            await transaction.request()
                .input("clientId", clientId)
                .query(`DELETE FROM dbo.onboarding_tasks WHERE client_id = @clientId`);
            console.log("  ✓ Deleted tasks");

            // 3. Delete client stage subtasks
            await transaction.request()
                .input("clientId", clientId)
                .query(`
                    DELETE FROM dbo.client_stage_subtasks 
                    WHERE client_stage_id IN (
                        SELECT client_stage_id FROM dbo.client_stages WHERE client_id = @clientId
                    )
                `);
            console.log("  ✓ Deleted client stage subtasks");

            // 4. Delete client stages
            await transaction.request()
                .input("clientId", clientId)
                .query(`DELETE FROM dbo.client_stages WHERE client_id = @clientId`);
            console.log("  ✓ Deleted client stages");

            // 5. Delete documents metadata (if there's a documents table)
            try {
                await transaction.request()
                    .input("clientId", clientId)
                    .query(`DELETE FROM dbo.documents WHERE client_id = @clientId`);
                console.log("  ✓ Deleted documents metadata");
            } catch (e) {
                // Table might not exist, continue
                console.log("  ⚠ No documents table or already empty");
            }

            // 6. Delete audit logs for this client
            try {
                await transaction.request()
                    .input("clientId", clientId)
                    .query(`DELETE FROM dbo.audit_logs WHERE client_id = @clientId`);
                console.log("  ✓ Deleted audit logs");
            } catch (e) {
                console.log("  ⚠ No audit_logs table or already empty");
            }

            // 7. Get the client email for user credentials deletion
            const clientEmailResult = await transaction.request()
                .input("clientId", clientId)
                .query(`SELECT primary_contact_email FROM dbo.Clients WHERE client_id = @clientId`);
            
            const clientEmail = clientEmailResult.recordset[0]?.primary_contact_email;

            // 8. Delete user credentials from Users table
            if (clientEmail) {
                await transaction.request()
                    .input("email", clientEmail)
                    .query(`DELETE FROM dbo.Users WHERE email = @email`);
                console.log("  ✓ Deleted user credentials");
            }

            // 9. Delete the client record itself
            await transaction.request()
                .input("clientId", clientId)
                .query(`DELETE FROM dbo.Clients WHERE client_id = @clientId`);
            console.log("  ✓ Deleted client record");

            // Commit transaction
            await transaction.commit();

            console.log(`✅ Successfully deleted client: ${clientName} (ID: ${clientId})`);

            return NextResponse.json({
                success: true,
                message: `Client "${clientName}" and all associated data have been deleted successfully.`,
                deletedClientId: clientId,
                deletedClientName: clientName,
            });


        } catch (innerError: any) {
            // Rollback on error
            await transaction.rollback();
            console.error("❌ Transaction rolled back due to error:", innerError);
            throw innerError;
        }

    } catch (error: any) {
        console.error("Delete client error:", error);

        // Check for foreign key constraint errors
        if (error.message?.includes("REFERENCE constraint") || error.message?.includes("FOREIGN KEY")) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Cannot delete client due to existing relationships. Please contact support.",
                    details: error.message
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, error: error.message || "Failed to delete client" },
            { status: 500 }
        );
    }
}
