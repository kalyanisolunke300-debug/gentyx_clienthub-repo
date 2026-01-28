// lib/email.ts
import { EmailClient, EmailMessage } from "@azure/communication-email";

// Create reusable email client using Azure Communication Services
const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING || "";
const emailClient = connectionString ? new EmailClient(connectionString) : null;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Azure Communication Services
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  console.log("📧 sendEmail called with:", { to, subject: subject.substring(0, 50) });
  console.log("📧 ACS Config:", {
    connectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING ? "✅ Set" : "❌ Missing",
    sender: process.env.AZURE_EMAIL_SENDER
  });

  if (!emailClient) {
    console.error("❌ Email client not initialized - missing connection string");
    return { success: false, error: "Email client not configured" };
  }

  const sender = process.env.AZURE_EMAIL_SENDER;
  if (!sender) {
    console.error("❌ Missing AZURE_EMAIL_SENDER environment variable");
    return { success: false, error: "Email sender not configured" };
  }

  try {
    const message: EmailMessage = {
      senderAddress: sender,
      content: {
        subject,
        html,
        plainText: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      },
      recipients: {
        to: [{ address: to }],
      },
    };

    // Send the email using ACS
    const poller = await emailClient.beginSend(message);
    const result = await poller.pollUntilDone();

    if (result.status === "Succeeded") {
      console.log("✅ Email sent successfully via Azure Communication Services:", result.id);
      return { success: true, messageId: result.id };
    } else {
      console.error("❌ Email send failed:", result.error);
      return { success: false, error: result.error };
    }
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
// ===== WELCOME EMAIL TEMPLATES =====

interface WelcomeEmailOptions {
  recipientEmail: string;
  recipientName: string;
  role: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  password: string;
  additionalInfo?: {
    clientName?: string;
    code?: string;
    centerCode?: string;
    cpaCode?: string;
  };
}

/**
 * Get login URL for the application
 */
function getLoginUrl(): string {
  return 'https://clienthub.hubonesystems.net/login';
}

/**
 * Get role-specific information
 */
function getRoleInfo(role: WelcomeEmailOptions['role']): { title: string; dashboardPath: string; icon: string; color: string } {
  switch (role) {
    case 'CLIENT':
      return { title: 'Client', dashboardPath: '/client', icon: '👤', color: '#6366f1' };
    case 'CPA':
      return { title: 'CPA', dashboardPath: '/cpa', icon: '📊', color: '#10b981' };
    case 'SERVICE_CENTER':
      return { title: 'Service Center', dashboardPath: '/service-center', icon: '🏢', color: '#f59e0b' };
    default:
      return { title: 'User', dashboardPath: '/', icon: '👤', color: '#6366f1' };
  }
}

/**
 * Send a welcome email when a new account is created
 */
export async function sendWelcomeEmail({
  recipientEmail,
  recipientName,
  role,
  password,
  additionalInfo,
}: WelcomeEmailOptions) {
  const roleInfo = getRoleInfo(role);
  const loginUrl = getLoginUrl();
  const currentYear = new Date().getFullYear();
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const subject = `🎉 Welcome to Legacy ClientHub - Your ${roleInfo.title} Account is Ready!`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Legacy ClientHub</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header with Logo -->
              <tr>
                <td style="background: linear-gradient(135deg, ${roleInfo.color} 0%, #8b5cf6 50%, #a855f7 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="font-size: 28px; color: white; font-weight: 700; letter-spacing: -0.5px;">Legacy</span>
                          <span style="font-size: 28px; color: white; font-weight: 700; letter-spacing: -0.5px; margin-left: 6px;">ClientHub</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center; padding-top: 10px;">
                        <span style="font-size: 50px;">${roleInfo.icon}</span>
                        <h1 style="color: white; margin: 15px 0 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Welcome, ${recipientName}!</h1>
                        <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0; font-size: 16px;">Your ${roleInfo.title} profile has been created</p>
                        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">${formattedDate}</p>
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
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          Congratulations! Your <strong style="color: ${roleInfo.color};">${roleInfo.title}</strong> account has been successfully created on Legacy ClientHub. 
                          You can now access the platform using the credentials below.
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Credentials Box -->
                    <tr>
                      <td style="padding: 0 0 30px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid ${roleInfo.color};">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: ${roleInfo.color}; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">🔐 Your Login Credentials</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Email:</td>
                                        <td style="font-size: 15px; color: #1e293b; font-weight: 600;">${recipientEmail}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Password:</td>
                                        <td style="font-size: 15px; color: #1e293b; font-weight: 600; font-family: 'Courier New', monospace; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; display: inline-block;">${password}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 0;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Role:</td>
                                        <td style="font-size: 15px; color: ${roleInfo.color}; font-weight: 600;">${roleInfo.title}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${additionalInfo?.clientName || additionalInfo?.code || additionalInfo?.centerCode || additionalInfo?.cpaCode ? `
                    <!-- Additional Info Box -->
                    <tr>
                      <td style="padding: 0 0 30px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #fef3c7; border-radius: 12px; border-left: 4px solid #f59e0b;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <p style="margin: 0 0 10px; font-size: 14px; color: #92400e; font-weight: 600;">📋 Account Details</p>
                              ${additionalInfo?.clientName ? `<p style="margin: 0 0 5px; font-size: 14px; color: #78350f;"><strong>Client Name:</strong> ${additionalInfo.clientName}</p>` : ''}
                              ${additionalInfo?.code ? `<p style="margin: 0 0 5px; font-size: 14px; color: #78350f;"><strong>Client Code:</strong> ${additionalInfo.code}</p>` : ''}
                              ${additionalInfo?.cpaCode ? `<p style="margin: 0 0 5px; font-size: 14px; color: #78350f;"><strong>CPA Code:</strong> ${additionalInfo.cpaCode}</p>` : ''}
                              ${additionalInfo?.centerCode ? `<p style="margin: 0; font-size: 14px; color: #78350f;"><strong>Center Code:</strong> ${additionalInfo.centerCode}</p>` : ''}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ` : ''}
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 30px;">
                        <a href="${loginUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, ${roleInfo.color} 0%, #8b5cf6 100%); color: white; font-size: 16px; font-weight: 600; padding: 16px 40px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                          Login to Your Account →
                        </a>
                      </td>
                    </tr>

                    <!-- Steps to Login -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f0fdf4; border-radius: 12px; border: 1px solid #86efac;">
                          <tr>
                            <td style="padding: 24px;">
                              <p style="margin: 0 0 15px; font-size: 16px; color: #166534; font-weight: 600;">📋 Steps to Login</p>
                              <ol style="margin: 0; padding-left: 20px; color: #166534; font-size: 14px; line-height: 1.8;">
                                <li>Open your web browser and go to <a href="${loginUrl}" style="color: #059669; font-weight: 600;">${loginUrl}</a></li>
                                <li>Enter your email: <strong>${recipientEmail}</strong></li>
                                <li>Enter your password: <strong style="font-family: 'Courier New', monospace;">${password}</strong></li>
                                <li>Click the <strong>"Sign In"</strong> button</li>
                                <li>You will be redirected to your ${roleInfo.title} dashboard</li>
                              </ol>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Password Reset Instructions -->
                    <tr>
                      <td style="padding: 0 0 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #eff6ff; border-radius: 12px; border: 1px solid #93c5fd;">
                          <tr>
                            <td style="padding: 24px;">
                              <p style="margin: 0 0 15px; font-size: 16px; color: #1e40af; font-weight: 600;">🔒 How to Reset Your Password</p>
                              <p style="margin: 0 0 12px; font-size: 14px; color: #1e40af; line-height: 1.6;">
                                For security reasons, we recommend changing your password after your first login. Here's how:
                              </p>
                              <ol style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                                <li>Log in to your account using the credentials above</li>
                                <li>Click on the <strong>"Settings"</strong> tab in the navigation menu</li>
                                <li>Navigate to the <strong>"Security"</strong> or <strong>"Password"</strong> section</li>
                                <li>Enter your current password</li>
                                <li>Enter and confirm your new password</li>
                                <li>Click <strong>"Update Password"</strong> to save your changes</li>
                              </ol>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Security Notice -->
                    <tr>
                      <td style="padding: 20px 0 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
                          <tr>
                            <td style="padding: 16px;">
                              <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
                                ⚠️ <strong>Security Notice:</strong> Keep your login credentials safe and do not share them with anyone. If you suspect unauthorized access to your account, please change your password immediately.
                              </p>
                            </td>
                          </tr>
                        </table>
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
                        <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">Need help? Contact our support team.</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: #64748b;">This is an automated notification from Legacy ClientHub.</p>
                        <div style="border-top: 1px solid #334155; padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #475569;">© ${currentYear} HubOne Systems Inc. – All Rights Reserved.</p>
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

// ===== CONVENIENCE FUNCTIONS FOR EACH ROLE =====

/**
 * Send welcome email for a new Client
 */
export async function sendClientWelcomeEmail(
  email: string,
  name: string,
  clientName?: string,
  code?: string
) {
  return sendWelcomeEmail({
    recipientEmail: email,
    recipientName: name,
    role: 'CLIENT',
    password: 'ClientHub@2025',
    additionalInfo: { clientName, code },
  });
}

/**
 * Send welcome email for a new CPA
 */
export async function sendCpaWelcomeEmail(
  email: string,
  name: string,
  cpaCode?: string
) {
  return sendWelcomeEmail({
    recipientEmail: email,
    recipientName: name,
    role: 'CPA',
    password: 'Cpa@12345',
    additionalInfo: { cpaCode },
  });
}

/**
 * Send welcome email for a new Service Center
 */
export async function sendServiceCenterWelcomeEmail(
  email: string,
  name: string,
  centerCode?: string
) {
  return sendWelcomeEmail({
    recipientEmail: email,
    recipientName: name,
    role: 'SERVICE_CENTER',
    password: 'ServiceCenter@2025',
    additionalInfo: { centerCode },
  });
}

// ===== NOTIFICATION EMAIL TEMPLATES =====

interface UpdateNotificationOptions {
  recipientEmail: string;
  recipientName: string;
  updateType: 'profile_updated' | 'task_assigned' | 'document_uploaded' | 'stage_changed' | 'message_received';
  details: {
    title: string;
    description: string;
    actionUrl?: string;
    actionLabel?: string;
  };
}

/**
 * Send a general update/notification email
 */
export async function sendUpdateNotification({
  recipientEmail,
  recipientName,
  updateType,
  details,
}: UpdateNotificationOptions) {
  const typeConfig: Record<string, { icon: string; color: string; label: string }> = {
    profile_updated: { icon: '✏️', color: '#8b5cf6', label: 'Profile Update' },
    task_assigned: { icon: '📋', color: '#3b82f6', label: 'New Task' },
    document_uploaded: { icon: '📄', color: '#10b981', label: 'New Document' },
    stage_changed: { icon: '🚀', color: '#f59e0b', label: 'Stage Update' },
    message_received: { icon: '💬', color: '#6366f1', label: 'New Message' },
  };

  const config = typeConfig[updateType] || typeConfig.profile_updated;
  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const subject = `${config.icon} ${config.label}: ${details.title} - Legacy ClientHub`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${config.label} Notification</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${config.color} 0%, #8b5cf6 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="font-size: 28px; color: white; font-weight: 700;">Legacy ClientHub</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center; padding-top: 10px;">
                        <span style="font-size: 50px;">${config.icon}</span>
                        <h1 style="color: white; margin: 15px 0 0; font-size: 24px; font-weight: 600;">${config.label}</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid ${config.color};">
                          <tr>
                            <td style="padding: 24px;">
                              <h3 style="margin: 0 0 12px; font-size: 18px; color: #1e293b;">${details.title}</h3>
                              <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">${details.description}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${details.actionUrl ? `
                    <tr>
                      <td style="text-align: center; padding: 10px 0 20px;">
                        <a href="${details.actionUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, ${config.color} 0%, #8b5cf6 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                          ${details.actionLabel || 'View Details'} →
                        </a>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #1e293b; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">This is an automated notification from Legacy ClientHub.</p>
                        <div style="border-top: 1px solid #334155; padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #475569;">© ${currentYear} HubOne Systems Inc. – All Rights Reserved.</p>
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

export async function sendMessageNotification({
  recipientEmail,
  recipientName,
  senderName,
  messagePreview,
  clientId,
}: MessageNotificationOptions) {
  const subject = `📬 New Message from ${senderName} - Legacy ClientHub`;
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
                          <span style="font-size: 28px; color: white; font-weight: 700; letter-spacing: -0.5px;">Legacy</span>
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
                        <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">This is an automated notification from Legacy ClientHub.</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: #64748b;">Please do not reply directly to this email.</p>
                        <div style="border-top: 1px solid #334155; padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #475569;">© ${currentYear} HubOne Systems Inc. – All Rights Reserved.</p>
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

// ===== TASK NOTIFICATION EMAIL TEMPLATES =====

interface TaskNotificationOptions {
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
  clientName: string;
  notificationType: 'assigned' | 'updated';
  updatedFields?: string[]; // For updates, list what changed
  assignedByName?: string;
}

/**
 * Get role-specific styling for task notifications
 */
function getTaskNotificationRoleConfig(role: TaskNotificationOptions['recipientRole']): {
  icon: string;
  color: string;
  title: string;
  dashboardUrl: string;
} {
  const baseUrl = 'https://clienthub.hubonesystems.net';

  switch (role) {
    case 'CLIENT':
      return {
        icon: '👤',
        color: '#6366f1',
        title: 'Client',
        dashboardUrl: `${baseUrl}/client`
      };
    case 'CPA':
      return {
        icon: '📊',
        color: '#10b981',
        title: 'CPA',
        dashboardUrl: `${baseUrl}/cpa`
      };
    case 'SERVICE_CENTER':
      return {
        icon: '🏢',
        color: '#f59e0b',
        title: 'Service Center',
        dashboardUrl: `${baseUrl}/servicecenter`
      };
    default:
      return {
        icon: '📋',
        color: '#6366f1',
        title: 'User',
        dashboardUrl: baseUrl
      };
  }
}

/**
 * Send a task notification email (for new task assignment or task update)
 */
export async function sendTaskNotificationEmail({
  recipientEmail,
  recipientName,
  recipientRole,
  taskTitle,
  taskDescription,
  dueDate,
  clientName,
  notificationType,
  updatedFields,
  assignedByName,
}: TaskNotificationOptions) {
  const roleConfig = getTaskNotificationRoleConfig(recipientRole);
  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const isNewTask = notificationType === 'assigned';
  const headerIcon = isNewTask ? '📋' : '✏️';
  const headerTitle = isNewTask ? 'New Task Assigned' : 'Task Updated';
  const headerColor = isNewTask ? '#3b82f6' : '#f59e0b';

  const subject = isNewTask
    ? `📋 New Task Assigned: ${taskTitle} - Legacy ClientHub`
    : `✏️ Task Updated: ${taskTitle} - Legacy ClientHub`;

  // Format due date nicely
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : 'Not specified';

  // Check if task is overdue
  const isOverdue = dueDate && new Date(dueDate) < new Date();
  const dueDateColor = isOverdue ? '#dc2626' : '#059669';
  const dueDateLabel = isOverdue ? '⚠️ OVERDUE' : '📅 Due Date';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${headerTitle}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${headerColor} 0%, #8b5cf6 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="font-size: 28px; color: white; font-weight: 700;">Legacy ClientHub</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center; padding-top: 10px;">
                        <span style="font-size: 50px;">${headerIcon}</span>
                        <h1 style="color: white; margin: 15px 0 0; font-size: 24px; font-weight: 600;">${headerTitle}</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          ${isNewTask
      ? `A new task has been assigned to you${assignedByName ? ` by <strong>${assignedByName}</strong>` : ''} for client <strong style="color: ${roleConfig.color};">${clientName}</strong>.`
      : `A task assigned to you for client <strong style="color: ${roleConfig.color};">${clientName}</strong> has been updated.`
    }
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Task Details Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid ${headerColor};">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: ${headerColor}; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">📋 Task Details</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Task:</td>
                                        <td style="font-size: 16px; color: #1e293b; font-weight: 600;">${taskTitle}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ${taskDescription ? `
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Description:</td>
                                        <td style="font-size: 14px; color: #475569;">${taskDescription}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ` : ''}
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Client:</td>
                                        <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${clientName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">${dueDateLabel}:</td>
                                        <td style="font-size: 14px; color: ${dueDateColor}; font-weight: 600;">${formattedDueDate}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td>
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Your Role:</td>
                                        <td>
                                          <span style="display: inline-block; background: ${roleConfig.color}; color: white; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px;">
                                            ${roleConfig.icon} ${roleConfig.title}
                                          </span>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${!isNewTask && updatedFields && updatedFields.length > 0 ? `
                    <!-- What Changed Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #fef3c7; border-radius: 12px; border-left: 4px solid #f59e0b;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <p style="margin: 0 0 10px; font-size: 14px; color: #92400e; font-weight: 600;">📝 What Changed</p>
                              <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                                ${updatedFields.map(field => `<li>${field}</li>`).join('')}
                              </ul>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ` : ''}
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 25px;">
                        <a href="${roleConfig.dashboardUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, ${headerColor} 0%, #8b5cf6 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                          View My Tasks →
                        </a>
                      </td>
                    </tr>

                    <!-- Action Required Notice -->
                    <tr>
                      <td style="padding: 0 0 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f0fdf4; border-radius: 12px; border: 1px solid #86efac;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <p style="margin: 0 0 10px; font-size: 14px; color: #166534; font-weight: 600;">✅ Action Required</p>
                              <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
                                Please log in to your Legacy ClientHub account to view the complete task details and take necessary action${dueDate ? ` before the due date` : ''}.
                              </p>
                            </td>
                          </tr>
                        </table>
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
                        <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">This is an automated notification from Legacy ClientHub.</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: #64748b;">Please do not reply directly to this email.</p>
                        <div style="border-top: 1px solid #334155; padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #475569;">© ${currentYear} HubOne Systems Inc. – All Rights Reserved.</p>
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

// ===== ONBOARDING TASK NOTIFICATION =====

interface OnboardingTaskNotificationOptions {
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  stageName: string;
  subtaskTitle: string;
  clientName: string;
  notificationType: 'assigned' | 'updated' | 'completed';
  dueDate?: string;
  assignedByName?: string;
}

/**
 * Send notification for onboarding task/subtask assignment or update
 */
export async function sendOnboardingTaskNotificationEmail({
  recipientEmail,
  recipientName,
  recipientRole,
  stageName,
  subtaskTitle,
  clientName,
  notificationType,
  dueDate,
  assignedByName,
}: OnboardingTaskNotificationOptions) {
  const roleConfig = getTaskNotificationRoleConfig(recipientRole);
  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  let headerIcon = '📋';
  let headerTitle = 'Onboarding Task Assigned';
  let headerColor = '#3b82f6';

  if (notificationType === 'updated') {
    headerIcon = '✏️';
    headerTitle = 'Onboarding Task Updated';
    headerColor = '#f59e0b';
  } else if (notificationType === 'completed') {
    headerIcon = '✅';
    headerTitle = 'Onboarding Task Completed';
    headerColor = '#10b981';
  }

  const subject = `${headerIcon} ${headerTitle}: ${subtaskTitle} - Legacy ClientHub`;

  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : null;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${headerTitle}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${headerColor} 0%, #8b5cf6 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="font-size: 28px; color: white; font-weight: 700;">Legacy ClientHub</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center; padding-top: 10px;">
                        <span style="font-size: 50px;">${headerIcon}</span>
                        <h1 style="color: white; margin: 15px 0 0; font-size: 24px; font-weight: 600;">${headerTitle}</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          ${notificationType === 'assigned'
      ? `An onboarding task has been assigned to you${assignedByName ? ` by <strong>${assignedByName}</strong>` : ''} for client <strong style="color: ${roleConfig.color};">${clientName}</strong>.`
      : notificationType === 'updated'
        ? `An onboarding task for client <strong style="color: ${roleConfig.color};">${clientName}</strong> has been updated.`
        : `An onboarding task for client <strong style="color: ${roleConfig.color};">${clientName}</strong> has been completed.`
    }
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Task Details Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid ${headerColor};">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: ${headerColor}; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">🚀 Onboarding Details</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Stage:</td>
                                        <td style="font-size: 14px; color: #1e293b; font-weight: 600;">${stageName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Task:</td>
                                        <td style="font-size: 16px; color: #1e293b; font-weight: 600;">${subtaskTitle}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Client:</td>
                                        <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${clientName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ${formattedDueDate ? `
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">📅 Due Date:</td>
                                        <td style="font-size: 14px; color: #059669; font-weight: 600;">${formattedDueDate}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ` : ''}
                                <tr>
                                  <td>
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Your Role:</td>
                                        <td>
                                          <span style="display: inline-block; background: ${roleConfig.color}; color: white; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px;">
                                            ${roleConfig.icon} ${roleConfig.title}
                                          </span>
                                        </td>
                                      </tr>
                                    </table>
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
                      <td style="text-align: center; padding: 10px 0 25px;">
                        <a href="${roleConfig.dashboardUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, ${headerColor} 0%, #8b5cf6 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                          View My Dashboard →
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
                        <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">This is an automated notification from Legacy ClientHub.</p>
                        <div style="border-top: 1px solid #334155; padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #475569;">© ${currentYear} HubOne Systems Inc. – All Rights Reserved.</p>
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


// ===== CLIENT ONBOARDING OVERVIEW EMAIL =====

interface OnboardingStage {
  name: string;
  status: string;
  subtasks?: {
    title: string;
    status: string;
    due_date?: string;
  }[];
}

interface OnboardingOverviewOptions {
  recipientEmail: string;
  recipientName: string;
  clientName: string;
  stages: OnboardingStage[];
  loginUrl?: string;
}

/**
 * Send an onboarding overview email to a client with all their stages and tasks
 */
export async function sendOnboardingOverviewEmail({
  recipientEmail,
  recipientName,
  clientName,
  stages,
  loginUrl = 'https://clienthub.hubonesystems.net/login',
}: OnboardingOverviewOptions) {
  console.log(`📧 sendOnboardingOverviewEmail called for ${recipientEmail}`);

  const currentYear = new Date().getFullYear();
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Build stages HTML
  const stagesHtml = stages.map((stage, index) => {
    const stageStatus = stage.status || 'Not Started';
    const statusColor = stageStatus === 'Completed' ? '#10b981' :
      stageStatus === 'In Progress' ? '#f59e0b' : '#6b7280';
    const statusBg = stageStatus === 'Completed' ? '#ecfdf5' :
      stageStatus === 'In Progress' ? '#fef3c7' : '#f3f4f6';

    // Build subtasks HTML if they exist
    const subtasksHtml = stage.subtasks && stage.subtasks.length > 0
      ? stage.subtasks.map((task, taskIndex) => {
        const taskStatus = task.status || 'Not Started';
        const taskStatusColor = taskStatus === 'Completed' ? '#10b981' :
          taskStatus === 'In Progress' ? '#f59e0b' : '#6b7280';
        const dueDate = task.due_date
          ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';

        return `
            <tr>
              <td style="padding: 8px 0 8px 24px; border-bottom: 1px solid #e5e7eb;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 20px; font-size: 12px; color: #9ca3af;">${taskIndex + 1}.</td>
                    <td style="font-size: 14px; color: #374151;">${task.title}</td>
                    <td style="text-align: right; width: 100px; font-size: 12px; color: #9ca3af;">${dueDate}</td>
                    <td style="text-align: right; width: 85px;">
                      <span style="display: inline-block; background: rgba(${taskStatus === 'Completed' ? '16,185,129' : taskStatus === 'In Progress' ? '245,158,11' : '107,114,128'}, 0.1); color: ${taskStatusColor}; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 10px;">${taskStatus}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
      }).join('')
      : `
        <tr>
          <td style="padding: 12px 24px; color: #9ca3af; font-size: 13px; font-style: italic;">No tasks assigned yet</td>
        </tr>
      `;

    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="font-size: 12px; color: #6b7280; font-weight: 500;">STAGE ${index + 1}</td>
                <td style="text-align: right;">
                  <span style="display: inline-block; background: ${statusBg}; color: ${statusColor}; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 10px; text-transform: uppercase;">${stageStatus}</span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 6px; font-size: 16px; color: #1e293b; font-weight: 600;">${stage.name}</td>
              </tr>
            </table>
          </td>
        </tr>
        ${subtasksHtml}
      </table>
    `;
  }).join('');

  const subject = `📋 Your Onboarding Journey Overview - ${clientName} - Legacy ClientHub`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Onboarding Overview</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="font-size: 28px; color: white; font-weight: 700;">Legacy ClientHub</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center; padding-top: 10px;">
                        <span style="font-size: 50px;">🗂️</span>
                        <h1 style="color: white; margin: 15px 0 0; font-size: 24px; font-weight: 600;">Your Onboarding Overview</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">${formattedDate}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          Below is a summary of your onboarding journey for <strong style="color: #6366f1;">${clientName}</strong>. 
                          This shows all the stages and tasks you need to complete for a successful onboarding.
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Info Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe;">
                          <tr>
                            <td style="padding: 16px 20px;">
                              <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 500;">
                                ℹ️ You have <strong>${stages.length}</strong> onboarding stage${stages.length !== 1 ? 's' : ''} to complete.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Stages List -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        ${stagesHtml}
                      </td>
                    </tr>
                    
                    <!-- Action Required Box -->
                    <tr>
                      <td style="padding: 0 0 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f0fdf4; border-radius: 12px; border: 1px solid #86efac;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <p style="margin: 0 0 10px; font-size: 14px; color: #166534; font-weight: 600;">✅ Ready to start?</p>
                              <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
                                Log in to your Legacy ClientHub account to view detailed task instructions, upload documents, and track your progress.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 0;">
                        <a href="${loginUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                          View My Dashboard →
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
                        <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">This is an automated notification from Legacy ClientHub.</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: #64748b;">Please do not reply directly to this email.</p>
                        <div style="border-top: 1px solid #334155; padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #475569;">© ${currentYear} HubOne Systems Inc. – All Rights Reserved.</p>
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


// ===== ADMIN NOTIFICATION EMAILS =====

interface AdminTaskCompletionOptions {
  adminEmail: string;
  adminName: string;
  taskTitle: string;
  clientName: string;
  completedByRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  completedByName: string;
  taskType: 'ASSIGNED' | 'ONBOARDING';
  stageName?: string; // For onboarding tasks
}

/**
 * Send notification to admin when a task is completed
 */
export async function sendAdminTaskCompletionEmail({
  adminEmail,
  adminName,
  taskTitle,
  clientName,
  completedByRole,
  completedByName,
  taskType,
  stageName,
}: AdminTaskCompletionOptions) {
  console.log(`📧 sendAdminTaskCompletionEmail called for ${adminEmail}`);

  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const roleLabels: Record<string, string> = {
    'CLIENT': 'Client',
    'CPA': 'CPA',
    'SERVICE_CENTER': 'Service Center',
  };

  const taskTypeLabel = taskType === 'ONBOARDING' ? 'Onboarding Task' : 'Assigned Task';
  const roleLabel = roleLabels[completedByRole] || completedByRole;

  const subject = `✅ Task Completed: ${taskTitle} - ${clientName}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Task Completed</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="font-size: 28px; color: white; font-weight: 700;">Legacy ClientHub</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center; padding-top: 10px;">
                        <span style="font-size: 50px;">✅</span>
                        <h1 style="color: white; margin: 15px 0 0; font-size: 24px; font-weight: 600;">Task Completed</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${adminName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          Great news! A task has been completed. Here are the details:
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Task Details Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border-left: 4px solid #10b981;">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: #10b981; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">✅ Completed</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Task:</td>
                                        <td style="font-size: 16px; color: #1e293b; font-weight: 600;">${taskTitle}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Task Type:</td>
                                        <td style="font-size: 14px; color: #1e293b;">${taskTypeLabel}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ${stageName ? `
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Stage:</td>
                                        <td style="font-size: 14px; color: #1e293b;">${stageName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ` : ''}
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Client:</td>
                                        <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${clientName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 0;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Completed By:</td>
                                        <td style="font-size: 14px; color: #1e293b;">
                                          <strong>${completedByName}</strong> <span style="color: #6b7280;">(${roleLabel})</span>
                                        </td>
                                      </tr>
                                    </table>
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
                      <td style="text-align: center; padding: 10px 0 0;">
                        <a href="https://clienthub.hubonesystems.net/admin" 
                           style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                          View Dashboard →
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
                        <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">This is an automated notification from Legacy ClientHub.</p>
                        <div style="border-top: 1px solid #334155; padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #475569;">© ${currentYear} HubOne Systems Inc. – All Rights Reserved.</p>
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
    to: adminEmail,
    subject,
    html,
  });
}


interface AdminMessageNotificationOptions {
  adminEmail: string;
  adminName: string;
  senderName: string;
  senderRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  messagePreview: string;
  clientName?: string;
}

/**
 * Send notification to admin when someone sends them a message
 */
export async function sendAdminMessageNotification({
  adminEmail,
  adminName,
  senderName,
  senderRole,
  messagePreview,
  clientName,
}: AdminMessageNotificationOptions) {
  console.log(`📧 sendAdminMessageNotification called for ${adminEmail}`);

  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const roleLabels: Record<string, string> = {
    'CLIENT': 'Client',
    'CPA': 'CPA',
    'SERVICE_CENTER': 'Service Center',
  };

  const roleLabel = roleLabels[senderRole] || senderRole;

  // Truncate message preview
  const truncatedPreview = messagePreview.length > 200
    ? messagePreview.substring(0, 200) + '...'
    : messagePreview;

  const subject = `💬 New Message from ${senderName} (${roleLabel})`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Message</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="font-size: 28px; color: white; font-weight: 700;">Legacy ClientHub</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center; padding-top: 10px;">
                        <span style="font-size: 50px;">💬</span>
                        <h1 style="color: white; margin: 15px 0 0; font-size: 24px; font-weight: 600;">New Message Received</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${adminName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          You have received a new message. Here are the details:
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Message Details Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid #3b82f6;">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: #3b82f6; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">💬 Message</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">From:</td>
                                        <td style="font-size: 16px; color: #1e293b; font-weight: 600;">${senderName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Role:</td>
                                        <td style="font-size: 14px; color: #1e293b;">${roleLabel}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ${clientName ? `
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Client:</td>
                                        <td style="font-size: 14px; color: #1e293b;">${clientName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ` : ''}
                                <tr>
                                  <td style="padding-top: 12px; border-top: 1px solid #e2e8f0;">
                                    <p style="margin: 0 0 8px; font-size: 14px; color: #64748b; font-weight: 500;">Message Preview:</p>
                                    <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                                      <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${truncatedPreview}</p>
                                    </div>
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
                      <td style="text-align: center; padding: 10px 0 0;">
                        <a href="https://clienthub.hubonesystems.net/admin" 
                           style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                          Reply Now →
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
                        <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">This is an automated notification from Legacy ClientHub.</p>
                        <div style="border-top: 1px solid #334155; padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #475569;">© ${currentYear} HubOne Systems Inc. – All Rights Reserved.</p>
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
    to: adminEmail,
    subject,
    html,
  });
}

