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
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get client info before deletion for logging
            const clientResult = await client.query(
                `SELECT client_name FROM public."Clients" WHERE client_id = $1`,
                [clientId]
            );

            const clientName = clientResult.rows[0]?.client_name || "Unknown";
            console.log(`🗑️ Starting deletion of client: ${clientName} (ID: ${clientId})`);

            // 1. Delete messages related to this client
            await client.query(
                `DELETE FROM public."onboarding_messages" WHERE client_id = $1`,
                [clientId]
            );
            console.log("  ✓ Deleted messages");

            // 2. Delete tasks related to this client
            await client.query(
                `DELETE FROM public."onboarding_tasks" WHERE client_id = $1`,
                [clientId]
            );
            console.log("  ✓ Deleted tasks");

            // 3. Delete client stage subtasks
            await client.query(`
                    DELETE FROM public."client_stage_subtasks" 
                    WHERE client_stage_id IN (
                        SELECT client_stage_id FROM public."client_stages" WHERE client_id = $1
                    )
                `, [clientId]);
            console.log("  ✓ Deleted client stage subtasks");

            // 4. Delete client stages
            await client.query(
                `DELETE FROM public."client_stages" WHERE client_id = $1`,
                [clientId]
            );
            console.log("  ✓ Deleted client stages");

            // 5. Delete documents metadata (if there's a documents table)
            try {
                await client.query(
                    `DELETE FROM public."documents" WHERE client_id = $1`,
                    [clientId]
                );
                console.log("  ✓ Deleted documents metadata");
            } catch (e) {
                console.log("  ⚠ No documents table or already empty");
            }

            // 6. Delete audit logs for this client
            try {
                await client.query(
                    `DELETE FROM public."audit_logs" WHERE client_id = $1`,
                    [clientId]
                );
                console.log("  ✓ Deleted audit logs");
            } catch (e) {
                console.log("  ⚠ No audit_logs table or already empty");
            }

            // 7. Get the client email for user credentials deletion
            const clientEmailResult = await client.query(
                `SELECT primary_contact_email FROM public."Clients" WHERE client_id = $1`,
                [clientId]
            );

            const clientEmail = clientEmailResult.rows[0]?.primary_contact_email;

            // 8. Delete user credentials from Users table
            if (clientEmail) {
                await client.query(
                    `DELETE FROM public."Users" WHERE email = $1`,
                    [clientEmail]
                );
                console.log("  ✓ Deleted user credentials");
            }

            // 9. Delete the client record itself
            await client.query(
                `DELETE FROM public."Clients" WHERE client_id = $1`,
                [clientId]
            );
            console.log("  ✓ Deleted client record");

            // Commit transaction
            await client.query('COMMIT');

            console.log(`✅ Successfully deleted client: ${clientName} (ID: ${clientId})`);

            return NextResponse.json({
                success: true,
                message: `Client "${clientName}" and all associated data have been deleted successfully.`,
                deletedClientId: clientId,
                deletedClientName: clientName,
            });

        } catch (innerError: any) {
            await client.query('ROLLBACK');
            console.error("❌ Transaction rolled back due to error:", innerError);
            throw innerError;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error("Delete client error:", error);

        if (error.message?.includes("foreign key") || error.message?.includes("violates foreign key")) {
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
