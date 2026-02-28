
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();

    // Check if table exists
    const checkTable = await pool.query(`
      SELECT * FROM information_schema.tables 
      WHERE table_name = 'AdminSettings' AND table_schema = 'public'
    `);

    if (checkTable.rows.length === 0) {
      // Create table if not exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public."AdminSettings" (
            id SERIAL PRIMARY KEY,
            full_name VARCHAR(255),
            email VARCHAR(255),
            phone VARCHAR(50),
            role VARCHAR(50) DEFAULT 'Administrator',
            notifications_enabled BOOLEAN DEFAULT true
        );
        INSERT INTO public."AdminSettings" (full_name, email, phone, role)
        VALUES ('Admin User', 'admin@mail.com', '', 'Administrator');
      `);
    }

    const result = await pool.query(`
      SELECT * FROM public."AdminSettings" LIMIT 1
    `);

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("Fetch Admin Profile Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
