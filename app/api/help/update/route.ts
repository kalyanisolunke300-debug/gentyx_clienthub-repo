// app/api/help/update/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { helpData } = body;

        if (!helpData || typeof helpData !== "object") {
            return NextResponse.json(
                { success: false, error: "Invalid help data" },
                { status: 400 }
            );
        }

        const pool = await getDbPool();

        // First, ensure the table exists
        await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='help_content' AND xtype='U')
      CREATE TABLE dbo.help_content (
        id INT IDENTITY(1,1) PRIMARY KEY,
        role_name NVARCHAR(50) NOT NULL UNIQUE,
        help_items NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

        // Update or insert each role's help content
        for (const [roleName, items] of Object.entries(helpData)) {
            const itemsJson = JSON.stringify(items);

            await pool.request()
                .input("roleName", sql.NVarChar(50), roleName)
                .input("items", sql.NVarChar(sql.MAX), itemsJson)
                .query(`
          MERGE dbo.help_content AS target
          USING (SELECT @roleName AS role_name) AS source
          ON target.role_name = source.role_name
          WHEN MATCHED THEN
            UPDATE SET help_items = @items, updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (role_name, help_items) VALUES (@roleName, @items);
        `);
        }

        return NextResponse.json({ success: true, message: "Help content updated successfully" });

    } catch (err: any) {
        console.error("POST /api/help/update error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update help content" },
            { status: 500 }
        );
    }
}
