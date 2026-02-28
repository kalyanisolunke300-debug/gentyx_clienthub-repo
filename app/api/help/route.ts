// app/api/help/route.ts - Multi-query split for PostgreSQL
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
    try {
        const pool = await getDbPool();

        // PostgreSQL doesn't support multiple recordsets - run separate queries
        const rolesResult = await pool.query(`SELECT role_id, role_key, title, description, icon_name, color_class, display_order FROM public."help_roles" WHERE is_active = true ORDER BY display_order`);
        const responsibilitiesResult = await pool.query(`SELECT responsibility_id, role_id, description, display_order FROM public."help_responsibilities" ORDER BY role_id, display_order`);
        const flowStepsResult = await pool.query(`SELECT step_id, role_id, title, description, icon_name, step_type, display_order FROM public."help_flow_steps" ORDER BY role_id, display_order`);
        const faqsResult = await pool.query(`SELECT faq_id, role_id, question, answer, display_order FROM public."help_faqs" ORDER BY role_id, display_order`);

        const updateText = (text: string) => {
            if (!text) return text;
            return text.replace(/\bCPA\b/g, "Preparer").replace(/\bCPAs\b/g, "Preparers").replace(/\bCPA's\b/g, "Preparer's");
        };

        const roles = rolesResult.rows.map((r: any) => ({ ...r, title: r.role_key === 'CPA' ? 'Preparer' : updateText(r.title), description: updateText(r.description) }));
        const responsibilities = responsibilitiesResult.rows.map((r: any) => ({ ...r, description: updateText(r.description) }));
        const flowSteps = flowStepsResult.rows.map((r: any) => ({ ...r, title: updateText(r.title), description: updateText(r.description) }));
        const faqs = faqsResult.rows.map((r: any) => ({ ...r, question: updateText(r.question), answer: updateText(r.answer) }));

        const helpContent = roles.map((role: any) => ({
            ...role,
            responsibilities: responsibilities.filter((r: any) => r.role_id === role.role_id).map((r: any) => ({ id: r.responsibility_id, description: r.description, order: r.display_order })),
            flow: flowSteps.filter((f: any) => f.role_id === role.role_id).map((f: any) => ({ id: f.step_id, title: f.title, description: f.description, icon: f.icon_name, type: f.step_type, order: f.display_order })),
            faqs: faqs.filter((faq: any) => faq.role_id === role.role_id).map((faq: any) => ({ id: faq.faq_id, question: faq.question, answer: faq.answer, order: faq.display_order })),
        }));

        return NextResponse.json({ success: true, data: helpContent });
    } catch (err) {
        console.error("GET /api/help error:", err);
        return NextResponse.json({ success: false, error: "Failed to fetch help content" }, { status: 500 });
    }
}
