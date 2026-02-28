// /app/api/messages/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");
    const conversationBetween = url.searchParams.get("conversationBetween");
    const serviceCenterId = url.searchParams.get("serviceCenterId");
    const cpaId = url.searchParams.get("cpaId");

    console.log("📨 Fetching messages:", { clientId, conversationBetween, serviceCenterId, cpaId });

    const pool = await getDbPool();

    let role1 = "", role2 = "";
    if (conversationBetween) {
      const roles = conversationBetween.split(",");
      role1 = roles[0] || ""; role2 = roles[1] || "";
    }

    const parsedClientId = clientId ? parseInt(clientId) : 0;
    const validClientId = parsedClientId > 0 ? parsedClientId : null;
    const parsedServiceCenterId = serviceCenterId ? parseInt(serviceCenterId) : null;
    const parsedCpaId = cpaId ? parseInt(cpaId) : null;

    const isChatWithSC = role1 === "SERVICE_CENTER" || role2 === "SERVICE_CENTER";
    const isChatWithCPA = role1 === "CPA" || role2 === "CPA";

    let query = "";
    let params: any[] = [];

    if (validClientId && isChatWithSC && parsedServiceCenterId) {
      query = `
        SELECT m.message_id, m.client_id, m.sender_role, m.receiver_role, m.body, m.parent_message_id,
          m.attachment_url, m.attachment_name, m.created_at, m.service_center_id, c.client_name
        FROM public."onboarding_messages" m
        LEFT JOIN public."Clients" c ON m.client_id = c.client_id
        WHERE m.client_id = $1
          AND (m.service_center_id = $2 OR m.service_center_id IS NULL)
          AND ((m.sender_role = $3 AND m.receiver_role = $4) OR (m.sender_role = $4 AND m.receiver_role = $3))
        ORDER BY m.created_at ASC
      `;
      params = [validClientId, parsedServiceCenterId, role1, role2];
    } else if (validClientId && isChatWithCPA && parsedCpaId) {
      query = `
        SELECT m.message_id, m.client_id, m.sender_role, m.receiver_role, m.body, m.parent_message_id,
          m.attachment_url, m.attachment_name, m.created_at, m.cpa_id, c.client_name
        FROM public."onboarding_messages" m
        LEFT JOIN public."Clients" c ON m.client_id = c.client_id
        WHERE m.client_id = $1
          AND (m.cpa_id = $2 OR m.cpa_id IS NULL)
          AND ((m.sender_role = $3 AND m.receiver_role = $4) OR (m.sender_role = $4 AND m.receiver_role = $3))
        ORDER BY m.created_at ASC
      `;
      params = [validClientId, parsedCpaId, role1, role2];
    } else if (validClientId) {
      if (!role1 && !role2) {
        query = `
          SELECT m.message_id, m.client_id, m.sender_role, m.receiver_role, m.body, m.parent_message_id,
            m.attachment_url, m.attachment_name, m.created_at, c.client_name, m.service_center_id, m.cpa_id
          FROM public."onboarding_messages" m
          LEFT JOIN public."Clients" c ON m.client_id = c.client_id
          WHERE m.client_id = $1
          ORDER BY m.created_at ASC
        `;
        params = [validClientId];
      } else {
        query = `
          SELECT m.message_id, m.client_id, m.sender_role, m.receiver_role, m.body, m.parent_message_id,
            m.attachment_url, m.attachment_name, m.created_at, c.client_name
          FROM public."onboarding_messages" m
          LEFT JOIN public."Clients" c ON m.client_id = c.client_id
          WHERE m.client_id = $1
            AND ((m.sender_role = $2 AND m.receiver_role = $3) OR (m.sender_role = $3 AND m.receiver_role = $2))
          ORDER BY m.created_at ASC
        `;
        params = [validClientId, role1, role2];
      }
    } else if (parsedServiceCenterId) {
      query = `
        SELECT m.message_id, m.client_id, m.sender_role, m.receiver_role, m.body, m.parent_message_id,
          m.attachment_url, m.attachment_name, m.created_at, m.service_center_id, NULL as client_name
        FROM public."onboarding_messages" m
        WHERE (m.client_id IS NULL OR m.client_id = 0)
          AND m.service_center_id = $1
          AND ((m.sender_role = $2 AND m.receiver_role = $3) OR (m.sender_role = $3 AND m.receiver_role = $2))
        ORDER BY m.created_at ASC
      `;
      params = [parsedServiceCenterId, role1, role2];
    } else if (parsedCpaId) {
      query = `
        SELECT m.message_id, m.client_id, m.sender_role, m.receiver_role, m.body, m.parent_message_id,
          m.attachment_url, m.attachment_name, m.created_at, m.cpa_id, NULL as client_name
        FROM public."onboarding_messages" m
        WHERE (m.client_id IS NULL OR m.client_id = 0)
          AND m.cpa_id = $1
          AND ((m.sender_role = $2 AND m.receiver_role = $3) OR (m.sender_role = $3 AND m.receiver_role = $2))
        ORDER BY m.created_at ASC
      `;
      params = [parsedCpaId, role1, role2];
    } else {
      query = `
        SELECT m.message_id, m.client_id, m.sender_role, m.receiver_role, m.body, m.parent_message_id,
          m.attachment_url, m.attachment_name, m.created_at, NULL as client_name
        FROM public."onboarding_messages" m
        WHERE (m.client_id IS NULL OR m.client_id = 0)
          AND m.service_center_id IS NULL AND m.cpa_id IS NULL
          AND ((m.sender_role = $1 AND m.receiver_role = $2) OR (m.sender_role = $2 AND m.receiver_role = $1))
        ORDER BY m.created_at ASC
      `;
      params = [role1, role2];
    }

    const result = await pool.query(query, params);
    console.log(`✅ Found ${result.rows.length} messages`);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("GET /api/messages/get error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
