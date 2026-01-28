// app/api/help/admin/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

// GET - Fetch all help content for admin editing
export async function GET() {
    try {
        const pool = await getDbPool();

        const result = await pool.request().query(`
      SELECT 
        role_id,
        role_key,
        title,
        description,
        icon_name,
        color_class,
        display_order,
        is_active
      FROM dbo.help_roles
      ORDER BY display_order;

      SELECT 
        responsibility_id,
        role_id,
        description,
        display_order
      FROM dbo.help_responsibilities
      ORDER BY role_id, display_order;

      SELECT 
        step_id,
        role_id,
        title,
        description,
        icon_name,
        step_type,
        display_order
      FROM dbo.help_flow_steps
      ORDER BY role_id, display_order;

      SELECT 
        faq_id,
        role_id,
        question,
        answer,
        display_order
      FROM dbo.help_faqs
      ORDER BY role_id, display_order;
    `);

        const recordsets = result.recordsets as sql.IRecordSet<any>[];

        return NextResponse.json({
            success: true,
            roles: recordsets[0] || [],
            responsibilities: recordsets[1] || [],
            flowSteps: recordsets[2] || [],
            faqs: recordsets[3] || [],
        });
    } catch (err) {
        console.error("GET /api/help/admin error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to fetch help content" },
            { status: 500 }
        );
    }
}

// PUT - Update role details
export async function PUT(req: Request) {
    try {
        const pool = await getDbPool();
        const body = await req.json();
        const { role_id, title, description, icon_name, color_class, is_active } = body;

        await pool
            .request()
            .input("role_id", sql.Int, role_id)
            .input("title", sql.NVarChar(100), title)
            .input("description", sql.NVarChar(sql.MAX), description)
            .input("icon_name", sql.NVarChar(50), icon_name)
            .input("color_class", sql.NVarChar(100), color_class)
            .input("is_active", sql.Bit, is_active)
            .query(`
        UPDATE dbo.help_roles
        SET 
          title = @title,
          description = @description,
          icon_name = COALESCE(@icon_name, icon_name),
          color_class = @color_class,
          is_active = @is_active,
          updated_at = GETDATE()
        WHERE role_id = @role_id
      `);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("PUT /api/help/admin error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to update role" },
            { status: 500 }
        );
    }
}
