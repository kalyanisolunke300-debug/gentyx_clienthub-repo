// app/api/clients/[id]/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const clientId = Number(id);

    if (!clientId || Number.isNaN(clientId)) {
      return NextResponse.json(
        { success: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool.query(`
      WITH "ClientBase" AS (
        SELECT
          c.client_id,
          c.client_name,
          c.code,
          c.client_status,
          c.sla_number,
          c.primary_contact_first_name,
          c.primary_contact_last_name,
          c.primary_contact_name,
          c.primary_contact_email,
          c.primary_contact_phone,
          c.created_at,
          c.updated_at,
          c.service_center_id,
          c.cpa_id,
          COALESCE(c.is_archived, false) AS is_archived
        FROM public."Clients" c
        WHERE c.client_id = $1
      ),

      "ClientWithStage" AS (
        SELECT
          cb.*,

          (
            SELECT cs.client_stage_id
            FROM public."client_stages" cs
            WHERE cs.client_id = cb.client_id
            ORDER BY cs.order_number
            LIMIT 1
          ) AS stage_id,

          (
            SELECT cs.stage_name
            FROM public."client_stages" cs
            WHERE cs.client_id = cb.client_id
            ORDER BY cs.order_number
            LIMIT 1
          ) AS stage_name

        FROM "ClientBase" cb
      ),

      "ClientStageProgress" AS (
        SELECT
          cws.*,

          (
            SELECT COUNT(*)
            FROM public."client_stages" cs
            WHERE cs.client_id = cws.client_id
          ) AS total_stages,

          (
            SELECT COUNT(*)
            FROM public."client_stages" cs
            WHERE cs.client_id = cws.client_id
              AND (
                cs.status = 'Completed'
                OR NOT EXISTS (
                  SELECT 1
                  FROM public."client_stage_subtasks" st
                  WHERE st.client_stage_id = cs.client_stage_id
                    AND st.status <> 'Completed'
                )
              )
          ) AS completed_stages
        FROM "ClientWithStage" cws
      )

      SELECT
        ctp.client_id,
        ctp.client_name,
        ctp.code,
        ctp.client_status,
        ctp.client_status AS status,
        ctp.sla_number,
        ctp.primary_contact_first_name,
        ctp.primary_contact_last_name,
        ctp.primary_contact_name,
        ctp.primary_contact_email,
        ctp.primary_contact_phone,
        ctp.created_at,
        ctp.updated_at,

        ctp.service_center_id,
        sc.center_name AS service_center_name,
        sc.email AS service_center_email,

        ctp.cpa_id,
        cp.cpa_name AS cpa_name,
        cp.email AS cpa_email,

        ctp.stage_id,
        ctp.stage_name,

        ctp.total_stages,
        ctp.completed_stages,

        CASE 
          WHEN ctp.total_stages = 0 THEN 0
          ELSE (ctp.completed_stages * 100.0) / ctp.total_stages
        END AS progress,

        ctp.is_archived

      FROM "ClientStageProgress" ctp
      LEFT JOIN public."service_centers" sc
        ON sc.service_center_id = ctp.service_center_id
      LEFT JOIN public."cpa_centers" cp
        ON cp.cpa_id = ctp.cpa_id
    `, [clientId]);

    const row = result.rows[0];

    if (!row) {
      return NextResponse.json(
        { success: false, error: "Client not found" },
        { status: 404 }
      );
    }

    // Fetch associated users for this client
    const usersResult = await pool.query(`
        SELECT 
          id,
          user_name AS name,
          email,
          role,
          phone,
          created_at
        FROM public."client_users"
        WHERE client_id = $1
        ORDER BY id ASC
      `, [clientId]);

    const associatedUsers = usersResult.rows;

    return NextResponse.json({
      success: true,
      data: {
        ...row,
        associated_users: associatedUsers,
      }
    });

  } catch (err) {
    console.error("GET client error:", err);

    return NextResponse.json(
      { success: false, error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}
