// lib/email.ts
import nodemailer from "nodemailer";

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using configured SMTP
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    });

    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error };
  }
}

interface MessageNotificationOptions {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
  clientId: number | string;
}

/**
 * Send a message notification email
 */
export async function sendMessageNotification({
  recipientEmail,
  recipientName,
  senderName,
  messagePreview,
  clientId,
}: MessageNotificationOptions) {
  const subject = `New Message from ${senderName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8B5CF6, #A78BFA); padding: 20px; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .message-box { background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #8B5CF6; margin: 15px 0; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📬 New Message</h1>
        </div>
        <div class="content">
          <p>Hi ${recipientName},</p>
          <p>You have received a new message from <strong>${senderName}</strong>:</p>
          
          <div class="message-box">
            <p style="margin: 0;">${messagePreview.length > 200 ? messagePreview.substring(0, 200) + '...' : messagePreview}</p>
          </div>
          
          <p>Log in to view the full message and reply.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from MySage ClientHub.</p>
          <p>Please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}
