// app/api/help/admin/faqs/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

// POST - Add new FAQ
export async function POST(req: Request) {
    try {
        const pool = await getDbPool();
        const body = await req.json();
        const { role_id, question, answer, display_order } = body;

        const result = await pool
            .request()
            .input("role_id", sql.Int, role_id)
            .input("question", sql.NVarChar(500), question)
            .input("answer", sql.NVarChar(sql.MAX), answer)
            .input("display_order", sql.Int, display_order || 0)
            .query(`
        INSERT INTO dbo.help_faqs (role_id, question, answer, display_order)
        OUTPUT INSERTED.faq_id
        VALUES (@role_id, @question, @answer, @display_order)
      `);

        return NextResponse.json({
            success: true,
            faq_id: result.recordset[0]?.faq_id,
        });
    } catch (err) {
        console.error("POST /api/help/admin/faqs error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to add FAQ" },
            { status: 500 }
        );
    }
}

// PUT - Update FAQ
export async function PUT(req: Request) {
    try {
        const pool = await getDbPool();
        const body = await req.json();
        const { faq_id, question, answer, display_order } = body;

        await pool
            .request()
            .input("faq_id", sql.Int, faq_id)
            .input("question", sql.NVarChar(500), question)
            .input("answer", sql.NVarChar(sql.MAX), answer)
            .input("display_order", sql.Int, display_order)
            .query(`
        UPDATE dbo.help_faqs
        SET 
          question = @question,
          answer = @answer,
          display_order = @display_order
        WHERE faq_id = @faq_id
      `);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("PUT /api/help/admin/faqs error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to update FAQ" },
            { status: 500 }
        );
    }
}

// DELETE - Remove FAQ
export async function DELETE(req: Request) {
    try {
        const pool = await getDbPool();
        const { searchParams } = new URL(req.url);
        const faq_id = searchParams.get("id");

        await pool
            .request()
            .input("faq_id", sql.Int, parseInt(faq_id || "0"))
            .query(`DELETE FROM dbo.help_faqs WHERE faq_id = @faq_id`);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/help/admin/faqs error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to delete FAQ" },
            { status: 500 }
        );
    }
}
