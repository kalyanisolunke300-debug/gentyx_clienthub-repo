// /app/api/messages/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");
    const conversationBetween = url.searchParams.get("conversationBetween");
    const serviceCenterId = url.searchParams.get("serviceCenterId");
    const cpaId = url.searchParams.get("cpaId");

    console.log("📨 Fetching messages:", { clientId, conversationBetween, serviceCenterId, cpaId });

    const pool = await getDbPool();

    // Parse conversation roles
    let role1 = "";
    let role2 = "";
    if (conversationBetween) {
      const roles = conversationBetween.split(",");
      role1 = roles[0] || "";
      role2 = roles[1] || "";
    }

    // Parse client ID
    const parsedClientId = clientId ? parseInt(clientId) : 0;
    const validClientId = parsedClientId > 0 ? parsedClientId : null;

    // Parse service_center_id and cpa_id
    const parsedServiceCenterId = serviceCenterId ? parseInt(serviceCenterId) : null;
    const parsedCpaId = cpaId ? parseInt(cpaId) : null;

    let query = "";
    let request = pool.request();

    // Check if we're chatting WITH a Service Center (role2 is SERVICE_CENTER or role1 is SERVICE_CENTER)
    const isChatWithSC = role1 === "SERVICE_CENTER" || role2 === "SERVICE_CENTER";
    const isChatWithCPA = role1 === "CPA" || role2 === "CPA";

    if (validClientId && isChatWithSC && parsedServiceCenterId) {
      // Client-specific messages WITH a specific Service Center
      query = `
        SELECT 
          m.message_id,
          m.client_id,
          m.sender_role,
          m.receiver_role,
          m.body,
          m.parent_message_id,
          m.attachment_url,
          m.attachment_name,
          m.created_at,
          m.service_center_id,
          c.client_name
        FROM dbo.onboarding_messages m
        LEFT JOIN dbo.Clients c ON m.client_id = c.client_id
        WHERE m.client_id = @client_id
          AND (m.service_center_id = @service_center_id OR m.service_center_id IS NULL)
          AND (
            (m.sender_role = @role1 AND m.receiver_role = @role2)
            OR (m.sender_role = @role2 AND m.receiver_role = @role1)
          )
        ORDER BY m.created_at ASC
      `;
      request
        .input("client_id", sql.Int, validClientId)
        .input("service_center_id", sql.Int, parsedServiceCenterId)
        .input("role1", sql.VarChar(50), role1)
        .input("role2", sql.VarChar(50), role2);
    } else if (validClientId && isChatWithCPA && parsedCpaId) {
      // Client-specific messages WITH a specific CPA
      query = `
        SELECT 
          m.message_id,
          m.client_id,
          m.sender_role,
          m.receiver_role,
          m.body,
          m.parent_message_id,
          m.attachment_url,
          m.attachment_name,
          m.created_at,
          m.cpa_id,
          c.client_name
        FROM dbo.onboarding_messages m
        LEFT JOIN dbo.Clients c ON m.client_id = c.client_id
        WHERE m.client_id = @client_id
          AND (m.cpa_id = @cpa_id OR m.cpa_id IS NULL)
          AND (
            (m.sender_role = @role1 AND m.receiver_role = @role2)
            OR (m.sender_role = @role2 AND m.receiver_role = @role1)
          )
        ORDER BY m.created_at ASC
      `;
      request
        .input("client_id", sql.Int, validClientId)
        .input("cpa_id", sql.Int, parsedCpaId)
        .input("role1", sql.VarChar(50), role1)
        .input("role2", sql.VarChar(50), role2);
    } else if (validClientId) {
      // Client-specific messages
      if (!role1 && !role2) {
        // ✅ FETCH ALL MESSAGES FOR THIS CLIENT (Dashboard view)
        query = `
          SELECT 
            m.message_id,
            m.client_id,
            m.sender_role,
            m.receiver_role,
            m.body,
            m.parent_message_id,
            m.attachment_url,
            m.attachment_name,
            m.created_at,
            c.client_name,
            m.service_center_id,
            m.cpa_id
          FROM dbo.onboarding_messages m
          LEFT JOIN dbo.Clients c ON m.client_id = c.client_id
          WHERE m.client_id = @client_id
          ORDER BY m.created_at ASC
        `;
        request.input("client_id", sql.Int, validClientId);
      } else {
        // Specific conversation (Client <-> Role)
        query = `
          SELECT 
            m.message_id,
            m.client_id,
            m.sender_role,
            m.receiver_role,
            m.body,
            m.parent_message_id,
            m.attachment_url,
            m.attachment_name,
            m.created_at,
            c.client_name
          FROM dbo.onboarding_messages m
          LEFT JOIN dbo.Clients c ON m.client_id = c.client_id
          WHERE m.client_id = @client_id
            AND (
              (m.sender_role = @role1 AND m.receiver_role = @role2)
              OR (m.sender_role = @role2 AND m.receiver_role = @role1)
            )
          ORDER BY m.created_at ASC
        `;
        request
          .input("client_id", sql.Int, validClientId)
          .input("role1", sql.VarChar(50), role1)
          .input("role2", sql.VarChar(50), role2);
      }
    } else if (parsedServiceCenterId) {
      // Service Center-specific messages (Admin <-> specific Service Center, no client)
      query = `
        SELECT 
          m.message_id,
          m.client_id,
          m.sender_role,
          m.receiver_role,
          m.body,
          m.parent_message_id,
          m.attachment_url,
          m.attachment_name,
          m.created_at,
          m.service_center_id,
          NULL as client_name
        FROM dbo.onboarding_messages m
        WHERE (m.client_id IS NULL OR m.client_id = 0)
          AND m.service_center_id = @service_center_id
          AND (
            (m.sender_role = @role1 AND m.receiver_role = @role2)
            OR (m.sender_role = @role2 AND m.receiver_role = @role1)
          )
        ORDER BY m.created_at ASC
      `;
      request
        .input("service_center_id", sql.Int, parsedServiceCenterId)
        .input("role1", sql.VarChar(50), role1)
        .input("role2", sql.VarChar(50), role2);
    } else if (parsedCpaId) {
      // CPA-specific messages (Admin <-> specific CPA, no client)
      query = `
        SELECT 
          m.message_id,
          m.client_id,
          m.sender_role,
          m.receiver_role,
          m.body,
          m.parent_message_id,
          m.attachment_url,
          m.attachment_name,
          m.created_at,
          m.cpa_id,
          NULL as client_name
        FROM dbo.onboarding_messages m
        WHERE (m.client_id IS NULL OR m.client_id = 0)
          AND m.cpa_id = @cpa_id
          AND (
            (m.sender_role = @role1 AND m.receiver_role = @role2)
            OR (m.sender_role = @role2 AND m.receiver_role = @role1)
          )
        ORDER BY m.created_at ASC
      `;
      request
        .input("cpa_id", sql.Int, parsedCpaId)
        .input("role1", sql.VarChar(50), role1)
        .input("role2", sql.VarChar(50), role2);
    } else {
      // Non-client-specific messages (fallback - should rarely be used now)
      query = `
        SELECT 
          m.message_id,
          m.client_id,
          m.sender_role,
          m.receiver_role,
          m.body,
          m.parent_message_id,
          m.attachment_url,
          m.attachment_name,
          m.created_at,
          NULL as client_name
        FROM dbo.onboarding_messages m
        WHERE (m.client_id IS NULL OR m.client_id = 0)
          AND m.service_center_id IS NULL
          AND m.cpa_id IS NULL
          AND (
            (m.sender_role = @role1 AND m.receiver_role = @role2)
            OR (m.sender_role = @role2 AND m.receiver_role = @role1)
          )
        ORDER BY m.created_at ASC
      `;
      request
        .input("role1", sql.VarChar(50), role1)
        .input("role2", sql.VarChar(50), role2);
    }

    const result = await request.query(query);

    console.log(`✅ Found ${result.recordset.length} messages`);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET /api/messages/get error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
