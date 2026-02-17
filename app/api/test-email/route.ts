
import { sendEmail } from "@/lib/email";
import { getDbPool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        // 1. Fetch current admin email from Database to verify the SQL update worked
        const pool = await getDbPool();
        const adminResult = await pool.request().query("SELECT TOP 1 email FROM AdminSettings");

        if (adminResult.recordset.length === 0) {
            return NextResponse.json({ error: "No admin found in AdminSettings table" }, { status: 404 });
        }

        const dbEmail = adminResult.recordset[0].email;

        // 2. Send email to the address found in the DB
        const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h1>Database Verification: Admin Email</h1>
        <p>This email was sent to the address currently stored in your <strong>AdminSettings</strong> database table.</p>
        <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin:0; font-weight:bold; color: #5a1f2d;">Stored Email: ${dbEmail}</p>
        </div>
        <p>✅ If you are reading this, your SQL update was successful and the system is correctly using your testing email.</p>
        <hr />
        <p style="font-size: 12px; color: #666;">Legacy ClientHub Verification</p>
      </div>
    `;

        const result = await sendEmail({
            to: dbEmail,
            subject: "Verification: Database Email Update Successful",
            html,
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `Email sent to database address: ${dbEmail}`,
                messageId: result.messageId
            });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
