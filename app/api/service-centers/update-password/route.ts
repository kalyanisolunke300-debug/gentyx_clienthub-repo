// app/api/service-centers/update-password/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { serviceCenterId, newPassword } = body;

        if (!serviceCenterId) {
            return NextResponse.json({ success: false, error: "Missing serviceCenterId" }, { status: 400 });
        }
        if (!newPassword || newPassword.length < 8) {
            return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 });
        }

        const pool = await getDbPool();

        const scResult = await pool.query(
            `SELECT email FROM public."service_centers" WHERE service_center_id = $1`,
            [serviceCenterId]
        );
        if (scResult.rows.length === 0) {
            return NextResponse.json({ success: false, error: "Service Center not found" }, { status: 404 });
        }

        const email = scResult.rows[0].email;
        if (!email) {
            return NextResponse.json({ success: false, error: "Service Center email not found" }, { status: 400 });
        }

        const updateResult = await pool.query(
            `UPDATE public."Users" SET password = $1 WHERE email = $2`,
            [newPassword, email]
        );
        if (updateResult.rowCount === 0) {
            return NextResponse.json({ success: false, error: "User not found in system" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Password updated successfully" });
    } catch (err: any) {
        console.error("POST /api/service-centers/update-password error:", err);
        return NextResponse.json({ success: false, error: err.message || "Failed to update password" }, { status: 500 });
    }
}
