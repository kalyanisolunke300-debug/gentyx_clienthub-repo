// app/api/admin/notifications/route.ts
// API endpoints for managing admin notification preferences

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

// GET: Fetch all admins with their notification settings
export async function GET() {
    try {
        const pool = await getDbPool();
        const result = await pool.query(`
            SELECT 
                id,
                full_name,
                email,
                COALESCE(notifications_enabled, true) as notifications_enabled
            FROM public."AdminSettings"
            WHERE email IS NOT NULL
            ORDER BY id
        `);

        return NextResponse.json({
            success: true,
            admins: result.rows.map((admin: any) => ({
                id: admin.id,
                fullName: admin.full_name || 'Admin',
                email: admin.email,
                notificationsEnabled: admin.notifications_enabled === true || admin.notifications_enabled === 1,
            })),
        });
    } catch (error: any) {
        console.error("GET /api/admin/notifications error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch admin notifications" },
            { status: 500 }
        );
    }
}

// PUT: Update notification preference for a specific admin
export async function PUT(req: Request) {
    try {
        const { adminId, notificationsEnabled } = await req.json();

        if (!adminId) {
            return NextResponse.json(
                { success: false, error: "Admin ID is required" },
                { status: 400 }
            );
        }

        if (typeof notificationsEnabled !== 'boolean') {
            return NextResponse.json(
                { success: false, error: "notificationsEnabled must be a boolean" },
                { status: 400 }
            );
        }

        const pool = await getDbPool();

        // Update the notification preference
        await pool.query(`
                UPDATE public."AdminSettings" 
                SET notifications_enabled = $1
                WHERE id = $2
            `, [notificationsEnabled, adminId]);

        return NextResponse.json({
            success: true,
            message: `Notifications ${notificationsEnabled ? 'enabled' : 'disabled'} for admin`,
        });
    } catch (error: any) {
        console.error("PUT /api/admin/notifications error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to update notification preference" },
            { status: 500 }
        );
    }
}
