import { getDbPool } from "@/lib/db";
import sql from "mssql";

// Helper to sanitize name for folder use (allow only alphanumeric, space, hyphens, underscores)
function sanitizeForFolder(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9 \-_]/g, "") // Keep only safe chars
        .trim()
        .replace(/\s+/g, " "); // Collapse spaces
}

/**
 * Returns the client's root folder name.
 * Default: "client-{id}"
 * Logic: Query DB for client_name. If found, use "{CleanName}-{id}".
 *        If not found or error, fallback to "client-{id}".
 * 
 * Note: This does NOT check if the folder exists in Azure.
 *       It only generates the EXPECTED folder name.
 */
export async function getClientRootFolder(clientId: number | string): Promise<string> {
    const id = Number(clientId);
    if (!id || isNaN(id)) return `client-${clientId}`; // Fallback

    try {
        const pool = await getDbPool();
        const res = await pool.request()
            .input("id", sql.Int, id)
            .query("SELECT client_name FROM Clients WHERE client_id = @id");

        const name = res.recordset[0]?.client_name;

        if (name) {
            const cleanName = sanitizeForFolder(name);
            if (cleanName) {
                return `${cleanName}-${id}`;
            }
        }
    } catch (err) {
        console.error("Error fetching client name for folder:", err);
    }

    return `client-${id}`;
}
