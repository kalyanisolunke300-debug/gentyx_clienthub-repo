import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
    try {
        const pool = await getDbPool();

        try { await pool.query(`ALTER TABLE public."onboarding_messages" ADD COLUMN IF NOT EXISTS parent_message_id INT NULL`); console.log("Added parent_message_id column"); } catch (e: any) { console.log("parent_message_id might already exist:", e.message); }
        try { await pool.query(`ALTER TABLE public."onboarding_messages" ADD COLUMN IF NOT EXISTS attachment_url TEXT NULL`); console.log("Added attachment_url column"); } catch (e: any) { console.log("attachment_url might already exist:", e.message); }
        try { await pool.query(`ALTER TABLE public."onboarding_messages" ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) NULL`); console.log("Added attachment_name column"); } catch (e: any) { console.log("attachment_name might already exist:", e.message); }

        return NextResponse.json({ success: true, message: "Migration attempted" });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
