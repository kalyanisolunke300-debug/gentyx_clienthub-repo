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
  console.log("📧 sendEmail called with:", { to, subject: subject.substring(0, 50) });
  console.log("📧 SMTP Config:", {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER ? "✅ Set" : "❌ Missing",
    pass: process.env.SMTP_PASS ? "✅ Set" : "❌ Missing",
    from: process.env.SMTP_FROM
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    });

    console.log("✅ Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("❌ Email send error:", error?.message || error);
    console.error("❌ Full error:", JSON.stringify(error, null, 2));
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
  const subject = `📬 New Message from ${senderName} - MySage ClientHub`;
  const currentYear = new Date().getFullYear();
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const formattedDateTime = `${formattedDate} at ${formattedTime}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Message Notification</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header with Logo -->
              <tr>
                <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="font-size: 28px; color: white; font-weight: 700; letter-spacing: -0.5px;">MySage</span>
                          <span style="font-size: 28px; color: white; font-weight: 700; letter-spacing: -0.5px; margin-left: 6px;">ClientHub</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center; padding-top: 10px;">
                        <span style="font-size: 40px;">💬</span>
                        <h1 style="color: white; margin: 15px 0 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">New Message Received</h1>
                        <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0; font-size: 14px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">You have received a new message from <strong style="color: #6366f1;">${senderName}</strong>:</p>
                      </td>
                    </tr>
                    
                    <!-- Message Box -->
                    <tr>
                      <td style="padding: 0 0 30px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid #8b5cf6;">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <span style="display: inline-block; background: #8b5cf6; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">Message Preview</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="font-size: 15px; color: #334155; line-height: 1.7;">
                                    "${messagePreview.length > 250 ? messagePreview.substring(0, 250) + '...' : messagePreview}"
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 20px;">
                        <p style="margin: 0 0 20px; font-size: 14px; color: #64748b;">Log in to your account to view the full message and reply.</p>
                        <a href="${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://clienthub.mysage.com'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                          View Message →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #1e293b; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">This is an automated notification from MySage ClientHub.</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: #64748b;">Please do not reply directly to this email.</p>
                        <div style="border-top: 1px solid #334155; padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #475569;">© ${currentYear} MySage ClientHub. All rights reserved.</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}
