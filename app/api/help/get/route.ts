// app/api/help/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
    try {
        const pool = await getDbPool();
        const result = await pool.query(`SELECT role_name, help_items FROM public."help_content"`);
        if (result.rows.length === 0) {
            return NextResponse.json({ success: true, data: { ADMIN: ["Create a client", "Assign Service Center and CPA", "Set initial stage or tasks"], CLIENT: ["Check Inbox and Tasks", "Upload required documents", "Ask a question if blocked"], SERVICE_CENTER: ["Review client uploads", "Assign tasks to client", "Leave feedback notes"], CPA: ["Review documents", "Set stage for assigned clients", "Create CPA tasks"] } });
        }
        const helpData: Record<string, string[]> = {};
        for (const row of result.rows) { helpData[row.role_name] = JSON.parse(row.help_items); }
        return NextResponse.json({ success: true, data: helpData });
    } catch (err: any) {
        console.error("GET /api/help/get error:", err);
        return NextResponse.json({ success: true, data: { ADMIN: ["Create a client", "Assign Service Center and CPA", "Set initial stage or tasks"], CLIENT: ["Check Inbox and Tasks", "Upload required documents", "Ask a question if blocked"], SERVICE_CENTER: ["Review client uploads", "Assign tasks to client", "Leave feedback notes"], CPA: ["Review documents", "Set stage for assigned clients", "Create CPA tasks"] } });
    }
}
