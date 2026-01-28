// app/api/help/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET() {
    try {
        const pool = await getDbPool();

        // Fetch all active roles with their responsibilities, flow steps, and FAQs
        const result = await pool.request().query(`
      -- Roles
      SELECT 
        role_id,
        role_key,
        title,
        description,
        icon_name,
        color_class,
        display_order
      FROM dbo.help_roles
      WHERE is_active = 1
      ORDER BY display_order;

      -- Responsibilities
      SELECT 
        responsibility_id,
        role_id,
        description,
        display_order
      FROM dbo.help_responsibilities
      ORDER BY role_id, display_order;

      -- Flow Steps
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

      -- FAQs
      SELECT 
        faq_id,
        role_id,
        question,
        answer,
        display_order
      FROM dbo.help_faqs
      ORDER BY role_id, display_order;
    `);

        const recordsets = result.recordsets as any[];
        const roles = recordsets[0] || [];
        const responsibilities = recordsets[1] || [];
        const flowSteps = recordsets[2] || [];
        const faqs = recordsets[3] || [];

        // Build structured response
        const helpContent = roles.map((role: any) => ({
            ...role,
            responsibilities: responsibilities
                .filter((r: any) => r.role_id === role.role_id)
                .map((r: any) => ({
                    id: r.responsibility_id,
                    description: r.description,
                    order: r.display_order,
                })),
            flow: flowSteps
                .filter((f: any) => f.role_id === role.role_id)
                .map((f: any) => ({
                    id: f.step_id,
                    title: f.title,
                    description: f.description,
                    icon: f.icon_name,
                    type: f.step_type,
                    order: f.display_order,
                })),
            faqs: faqs
                .filter((faq: any) => faq.role_id === role.role_id)
                .map((faq: any) => ({
                    id: faq.faq_id,
                    question: faq.question,
                    answer: faq.answer,
                    order: faq.display_order,
                })),
        }));

        return NextResponse.json({
            success: true,
            data: helpContent,
        });
    } catch (err) {
        console.error("GET /api/help error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to fetch help content" },
            { status: 500 }
        );
    }
}
