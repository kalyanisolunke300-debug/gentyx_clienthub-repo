import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");
    const senderRole = url.searchParams.get("senderRole"); // e.g., "CLIENT"
    const receiverRole = url.searchParams.get("receiverRole"); // e.g., "SERVICE_CENTER"
    const conversationBetween = url.searchParams.get("conversationBetween"); // e.g., "CLIENT,SERVICE_CENTER"

    const pool = await getDbPool();

    const request = pool.request();

    // Handle clientId: "0" means admin-level chat (no specific client)
    const validClientId = clientId && parseInt(clientId) > 0 ? parseInt(clientId) : null;

    if (validClientId) {
      request.input("clientId", sql.Int, validClientId);
    }

    // Build dynamic WHERE clause
    let whereConditions: string[] = [];

    if (validClientId) {
      whereConditions.push("m.client_id = @clientId");
    } else if (clientId === "0") {
      // Admin-level chat: get messages where client_id is NULL
      whereConditions.push("m.client_id IS NULL");
    }

    // Filter by specific sender role
    if (senderRole) {
      request.input("senderRole", sql.VarChar(50), senderRole);
      whereConditions.push("m.sender_role = @senderRole");
    }

    // Filter by specific receiver role
    if (receiverRole) {
      request.input("receiverRole", sql.VarChar(50), receiverRole);
      whereConditions.push("m.receiver_role = @receiverRole");
    }

    // Filter for conversation between TWO specific roles (bidirectional)
    // e.g., conversationBetween=CLIENT,SERVICE_CENTER will get all messages where:
    // (sender=CLIENT AND receiver=SERVICE_CENTER) OR (sender=SERVICE_CENTER AND receiver=CLIENT)
    if (conversationBetween) {
      const [role1, role2] = conversationBetween.split(",").map(r => r.trim());
      if (role1 && role2) {
        request.input("role1", sql.VarChar(50), role1);
        request.input("role2", sql.VarChar(50), role2);
        whereConditions.push(`(
          (m.sender_role = @role1 AND m.receiver_role = @role2) OR
          (m.sender_role = @role2 AND m.receiver_role = @role1)
        )`);
      }
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

    const query = `
      SELECT 
        m.message_id,
        m.client_id,
        c.client_name,
        sc.center_name AS service_center_name,
        m.sender_role,
        m.receiver_role,
        m.body,
        m.parent_message_id,
        m.attachment_url,
        m.attachment_name,
        m.created_at
      FROM dbo.onboarding_messages m
      LEFT JOIN dbo.clients c ON m.client_id = c.client_id
      LEFT JOIN dbo.service_centers sc ON c.service_center_id = sc.service_center_id
      ${whereClause}
      ORDER BY m.created_at ASC
    `;

    const result = await request.query(query);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET /api/messages/get error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
