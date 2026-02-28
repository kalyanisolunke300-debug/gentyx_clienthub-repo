// app/api/help/admin/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getDbPool();
    const rolesResult = await pool.query(`SELECT role_id, role_key, title, description, icon_name, color_class, display_order, is_active FROM public."help_roles" ORDER BY display_order`);
    const responsibilitiesResult = await pool.query(`SELECT responsibility_id, role_id, description, display_order FROM public."help_responsibilities" ORDER BY role_id, display_order`);
    const flowStepsResult = await pool.query(`SELECT step_id, role_id, title, description, icon_name, step_type, display_order FROM public."help_flow_steps" ORDER BY role_id, display_order`);
    const faqsResult = await pool.query(`SELECT faq_id, role_id, question, answer, display_order FROM public."help_faqs" ORDER BY role_id, display_order`);

    return NextResponse.json({ success: true, roles: rolesResult.rows, responsibilities: responsibilitiesResult.rows, flowSteps: flowStepsResult.rows, faqs: faqsResult.rows });
  } catch (err) {
    console.error("GET /api/help/admin error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch help content" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const pool = await getDbPool();
    const body = await req.json();
    const { role_id, title, description, icon_name, color_class, is_active } = body;

    await pool.query(`
        UPDATE public."help_roles"
        SET title = $1, description = $2, icon_name = COALESCE($3, icon_name), color_class = $4, is_active = $5, updated_at = NOW()
        WHERE role_id = $6
      `, [title, description, icon_name, color_class, is_active, role_id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/help/admin error:", err);
    return NextResponse.json({ success: false, error: "Failed to update role" }, { status: 500 });
  }
}
