
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET() {
    try {
        const pool = await getDbPool();

        // 1. Add parent_message_id
        try {
            await pool.request().query(`
        ALTER TABLE dbo.onboarding_messages
        ADD parent_message_id INT NULL;
      `);
            console.log("Added parent_message_id column");
        } catch (e: any) {
            console.log("parent_message_id might already exist:", e.message);
        }

        // 2. Add attachment_url
        try {
            await pool.request().query(`
        ALTER TABLE dbo.onboarding_messages
        ADD attachment_url NVARCHAR(MAX) NULL;
      `);
            console.log("Added attachment_url column");
        } catch (e: any) {
            console.log("attachment_url might already exist:", e.message);
        }

        // 3. Add attachment_name
        try {
            await pool.request().query(`
        ALTER TABLE dbo.onboarding_messages
        ADD attachment_name NVARCHAR(255) NULL;
      `);
            console.log("Added attachment_name column");
        } catch (e: any) {
            console.log("attachment_name might already exist:", e.message);
        }

        return NextResponse.json({ success: true, message: "Migration attempted" });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
