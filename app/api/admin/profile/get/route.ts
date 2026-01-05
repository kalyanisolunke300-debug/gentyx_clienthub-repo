
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
    try {
        const pool = await getDbPool();

        // Check if table exists
        const checkTable = await pool.request().query(`
      SELECT * FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'AdminSettings'
    `);

        if (checkTable.recordset.length === 0) {
            // Create table if not exists
            await pool.request().query(`
        CREATE TABLE AdminSettings (
            id INT IDENTITY(1,1) PRIMARY KEY,
            full_name NVARCHAR(255),
            email NVARCHAR(255),
            phone NVARCHAR(50),
            role NVARCHAR(50) DEFAULT 'Administrator'
        );
        INSERT INTO AdminSettings (full_name, email, phone, role)
        VALUES ('Admin User', 'admin@mail.com', '', 'Administrator');
      `);
        }

        const result = await pool.request().query(`
      SELECT TOP 1 * FROM AdminSettings
    `);

        return NextResponse.json({ success: true, data: result.recordset[0] });
    } catch (error: any) {
        console.error("Fetch Admin Profile Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
