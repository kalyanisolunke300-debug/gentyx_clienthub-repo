// app/api/help/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { helpData } = body;
        if (!helpData || typeof helpData !== "object") return NextResponse.json({ success: false, error: "Invalid help data" }, { status: 400 });

        const pool = await getDbPool();

        // Ensure table exists (PostgreSQL syntax)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS public."help_content" (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL UNIQUE,
        help_items TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Upsert each role (PostgreSQL ON CONFLICT)
        for (const [roleName, items] of Object.entries(helpData)) {
            const itemsJson = JSON.stringify(items);
            await pool.query(`
          INSERT INTO public."help_content" (role_name, help_items, updated_at) VALUES ($1, $2, NOW())
          ON CONFLICT (role_name) DO UPDATE SET help_items = $2, updated_at = NOW()
        `, [roleName, itemsJson]);
        }

        return NextResponse.json({ success: true, message: "Help content updated successfully" });
    } catch (err: any) {
        console.error("POST /api/help/update error:", err);
        return NextResponse.json({ success: false, error: err.message || "Failed to update help content" }, { status: 500 });
    }
}
