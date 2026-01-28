// app/api/help/admin/responsibilities/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

// POST - Add new responsibility
export async function POST(req: Request) {
    try {
        const pool = await getDbPool();
        const body = await req.json();
        const { role_id, description, display_order } = body;

        const result = await pool
            .request()
            .input("role_id", sql.Int, role_id)
            .input("description", sql.NVarChar(sql.MAX), description)
            .input("display_order", sql.Int, display_order || 0)
            .query(`
        INSERT INTO dbo.help_responsibilities (role_id, description, display_order)
        OUTPUT INSERTED.responsibility_id
        VALUES (@role_id, @description, @display_order)
      `);

        return NextResponse.json({
            success: true,
            responsibility_id: result.recordset[0]?.responsibility_id,
        });
    } catch (err) {
        console.error("POST /api/help/admin/responsibilities error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to add responsibility" },
            { status: 500 }
        );
    }
}

// PUT - Update responsibility
export async function PUT(req: Request) {
    try {
        const pool = await getDbPool();
        const body = await req.json();
        const { responsibility_id, description, display_order } = body;

        await pool
            .request()
            .input("responsibility_id", sql.Int, responsibility_id)
            .input("description", sql.NVarChar(sql.MAX), description)
            .input("display_order", sql.Int, display_order)
            .query(`
        UPDATE dbo.help_responsibilities
        SET description = @description, display_order = @display_order
        WHERE responsibility_id = @responsibility_id
      `);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("PUT /api/help/admin/responsibilities error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to update responsibility" },
            { status: 500 }
        );
    }
}

// DELETE - Remove responsibility
export async function DELETE(req: Request) {
    try {
        const pool = await getDbPool();
        const { searchParams } = new URL(req.url);
        const responsibility_id = searchParams.get("id");

        await pool
            .request()
            .input("responsibility_id", sql.Int, parseInt(responsibility_id || "0"))
            .query(`DELETE FROM dbo.help_responsibilities WHERE responsibility_id = @responsibility_id`);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/help/admin/responsibilities error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to delete responsibility" },
            { status: 500 }
        );
    }
}
