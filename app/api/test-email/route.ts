// app/api/test-email/route.ts
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const to = searchParams.get("to");

    if (!to) {
        return NextResponse.json(
            { error: "Please provide a 'to' email parameter, e.g., /api/test-email?to=your@email.com" },
            { status: 400 }
        );
    }

    console.log("🧪 Testing email to:", to);

    const result = await sendEmail({
        to,
        subject: "🧪 Test Email from Legacy ClientHub",
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
                <h1 style="color: #6366f1;">✅ Email Test Successful!</h1>
                <p>This is a test email sent via <strong>Azure Communication Services</strong>.</p>
                <p style="color: #64748b; font-size: 14px;">Sent at: ${new Date().toLocaleString()}</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px;">Legacy ClientHub - Email Integration Test</p>
            </div>
        `,
    });

    if (result.success) {
        return NextResponse.json({
            success: true,
            message: `Test email sent successfully to ${to}`,
            messageId: result.messageId,
        });
    } else {
        return NextResponse.json(
            { success: false, error: result.error },
            { status: 500 }
        );
    }
}
