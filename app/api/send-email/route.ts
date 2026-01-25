// app/api/send-email/route.ts
import { NextResponse } from "next/server";
import { EmailClient, EmailMessage } from "@azure/communication-email";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { to, subject, body: emailBody, clientName } = body;

        if (!to || !subject || !emailBody) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: to, subject, body" },
                { status: 400 }
            );
        }

        // Replace template variables in the body
        let processedBody = emailBody;
        if (clientName) {
            processedBody = processedBody.replace(/\{\{clientName\}\}/g, clientName);
        }

        // Validate Azure Communication Services configuration
        const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
        const sender = process.env.AZURE_EMAIL_SENDER;

        if (!connectionString) {
            console.error("❌ Missing AZURE_COMMUNICATION_CONNECTION_STRING");
            return NextResponse.json(
                { success: false, error: "Email service not configured (missing connection string)" },
                { status: 500 }
            );
        }

        if (!sender) {
            console.error("❌ Missing AZURE_EMAIL_SENDER");
            return NextResponse.json(
                { success: false, error: "Email service not configured (missing sender address)" },
                { status: 500 }
            );
        }

        // Create Azure Communication Services email client
        const emailClient = new EmailClient(connectionString);

        // Prepare the email message
        const message: EmailMessage = {
            senderAddress: sender,
            content: {
                subject: subject,
                html: processedBody,
                plainText: processedBody.replace(/<[^>]*>/g, ""), // Strip HTML for plain text fallback
            },
            recipients: {
                to: [{ address: to }],
            },
        };

        // Send the email using Azure Communication Services
        const poller = await emailClient.beginSend(message);
        const result = await poller.pollUntilDone();

        if (result.status === "Succeeded") {
            console.log("✅ Email sent successfully via Azure Communication Services:", result.id);
            return NextResponse.json({
                success: true,
                messageId: result.id,
                message: `Email sent successfully to ${to}`,
            });
        } else {
            console.error("❌ Email send failed:", result.error);
            return NextResponse.json(
                { success: false, error: result.error?.message || "Failed to send email" },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("Send email error:", error);

        // Handle Azure Communication Services specific errors
        let errorMessage = "Failed to send email";
        if (error.code === "InvalidEmailAddress") {
            errorMessage = "Invalid email address provided.";
        } else if (error.code === "Unauthorized") {
            errorMessage = "Email service authentication failed. Please check configuration.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
