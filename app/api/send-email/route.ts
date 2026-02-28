// app/api/send-email/route.ts
// ⚠️  Azure Communication Services credentials are not available.
//     Email sending is currently DISABLED. Wire in a new provider (e.g. Resend, SendGrid)
//     and replace the stub below when credentials are ready.

import { NextResponse } from "next/server";
import { wrapEmailContent } from "@/lib/email";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { to, subject, body: emailBody, clientName, useTemplate = true } = body;

        if (!to || !subject || !emailBody) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: to, subject, body" },
                { status: 400 }
            );
        }

        // Email service is not configured — log and return a graceful response.
        console.warn(
            `[send-email] Email not sent (service not configured). Would have sent to: ${to}, subject: "${subject}"`
        );

        return NextResponse.json(
            {
                success: false,
                disabled: true,
                error:
                    "Email service is not configured. Please add AZURE_COMMUNICATION_CONNECTION_STRING / AZURE_EMAIL_SENDER, or switch to a new email provider (e.g. Resend, SendGrid).",
            },
            { status: 503 }
        );
    } catch (error: any) {
        console.error("Send email error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to send email" },
            { status: 500 }
        );
    }
}
