// app/api/help/admin/flow-steps/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

// POST - Add new flow step
export async function POST(req: Request) {
    try {
        const pool = await getDbPool();
        const body = await req.json();
        const { role_id, title, description, icon_name, step_type, display_order } = body;

        const result = await pool
            .request()
            .input("role_id", sql.Int, role_id)
            .input("title", sql.NVarChar(200), title)
            .input("description", sql.NVarChar(sql.MAX), description)
            .input("icon_name", sql.NVarChar(50), icon_name || null)
            .input("step_type", sql.NVarChar(50), step_type || "action")
            .input("display_order", sql.Int, display_order || 0)
            .query(`
        INSERT INTO dbo.help_flow_steps (role_id, title, description, icon_name, step_type, display_order)
        OUTPUT INSERTED.step_id
        VALUES (@role_id, @title, @description, @icon_name, @step_type, @display_order)
      `);

        return NextResponse.json({
            success: true,
            step_id: result.recordset[0]?.step_id,
        });
    } catch (err) {
        console.error("POST /api/help/admin/flow-steps error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to add flow step" },
            { status: 500 }
        );
    }
}

// PUT - Update flow step
export async function PUT(req: Request) {
    try {
        const pool = await getDbPool();
        const body = await req.json();
        const { step_id, title, description, icon_name, step_type, display_order } = body;

        await pool
            .request()
            .input("step_id", sql.Int, step_id)
            .input("title", sql.NVarChar(200), title)
            .input("description", sql.NVarChar(sql.MAX), description)
            .input("icon_name", sql.NVarChar(50), icon_name || null)
            .input("step_type", sql.NVarChar(50), step_type || "action")
            .input("display_order", sql.Int, display_order)
            .query(`
        UPDATE dbo.help_flow_steps
        SET 
          title = @title,
          description = @description,
          icon_name = @icon_name,
          step_type = @step_type,
          display_order = @display_order
        WHERE step_id = @step_id
      `);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("PUT /api/help/admin/flow-steps error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to update flow step" },
            { status: 500 }
        );
    }
}

// DELETE - Remove flow step
export async function DELETE(req: Request) {
    try {
        const pool = await getDbPool();
        const { searchParams } = new URL(req.url);
        const step_id = searchParams.get("id");

        await pool
            .request()
            .input("step_id", sql.Int, parseInt(step_id || "0"))
            .query(`DELETE FROM dbo.help_flow_steps WHERE step_id = @step_id`);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/help/admin/flow-steps error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to delete flow step" },
            { status: 500 }
        );
    }
}
