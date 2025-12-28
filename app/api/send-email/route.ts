// app/api/send-email/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

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

        // Create transporter using environment variables
        // For production, use your actual SMTP settings
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS, // Matches .env.local variable name
            },
        });

        // Verify connection configuration
        await transporter.verify();

        // Send the email
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: to,
            subject: subject,
            html: processedBody, // Use HTML body for rich content
            text: processedBody.replace(/<[^>]*>/g, ""), // Strip HTML for plain text fallback
        });

        console.log("Email sent successfully:", info.messageId);

        return NextResponse.json({
            success: true,
            messageId: info.messageId,
            message: `Email sent successfully to ${to}`,
        });
    } catch (error: any) {
        console.error("Send email error:", error);

        // Handle specific nodemailer errors
        let errorMessage = "Failed to send email";
        if (error.code === "EAUTH") {
            errorMessage = "SMTP authentication failed. Please check your email credentials.";
        } else if (error.code === "ECONNECTION") {
            errorMessage = "Could not connect to email server. Please check SMTP settings.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
