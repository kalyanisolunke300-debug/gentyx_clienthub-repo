// app/api/clients/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const pool = await getDbPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
    const pageSize = Math.max(parseInt(searchParams.get("pageSize") || "10"), 1);
    const q = (searchParams.get("q") || "").trim();
    const statusFilter = (searchParams.get("status") || "ALL").trim();
    const archiveFilter = (searchParams.get("archiveFilter") || "ALL").trim();
    const offset = (page - 1) * pageSize;

    // Main data query
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
          COALESCE(c.is_archived, false) AS is_archived,
          sc.center_name AS service_center_name,
          cp.cpa_name AS cpa_name
        FROM public."Clients" c
        LEFT JOIN public."service_centers" sc ON sc.service_center_id = c.service_center_id
        LEFT JOIN public."cpa_centers" cp ON cp.cpa_id = c.cpa_id
        WHERE
          (
            $3 = 'ALL' 
            OR ($3 = 'active' AND COALESCE(c.is_archived, false) = false)
            OR ($3 = 'archived' AND c.is_archived = true)
          )
          AND (
            $1 = '' OR
            c.client_name ILIKE '%' || $1 || '%' OR
            c.code ILIKE '%' || $1 || '%' OR
            c.primary_contact_name ILIKE '%' || $1 || '%' OR
            sc.center_name ILIKE '%' || $1 || '%' OR
            cp.cpa_name ILIKE '%' || $1 || '%'
          )
      ),

      "ClientWithStage" AS (
        SELECT
          cb.*,

          COALESCE(
            (
              SELECT cs.stage_name
              FROM public."client_stages" cs
              WHERE cs.client_id = cb.client_id
                AND cs.status = 'In Progress'
              ORDER BY cs.order_number
              LIMIT 1
            ),
            (
              SELECT cs.stage_name
              FROM public."client_stages" cs
              WHERE cs.client_id = cb.client_id
                AND cs.status = 'Completed'
              ORDER BY cs.order_number DESC
              LIMIT 1
            ),
            (
              SELECT cs.stage_name
              FROM public."client_stages" cs
              WHERE cs.client_id = cb.client_id
                AND cs.status = 'Not Started'
                AND cs.is_required = true
              ORDER BY cs.order_number
              LIMIT 1
            )
          ) AS stage_name,

          CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM public."client_stages" cs
              WHERE cs.client_id = cb.client_id
            ) THEN 'Not Started'
            WHEN NOT EXISTS (
              SELECT 1 FROM public."client_stages" cs
              WHERE cs.client_id = cb.client_id
                AND cs.status <> 'Completed'
            ) THEN 'Completed'
            WHEN NOT EXISTS (
              SELECT 1 FROM public."client_stages" cs
              WHERE cs.client_id = cb.client_id
                AND cs.status <> 'Not Started'
            ) THEN 'Not Started'
            ELSE 'In Progress'
          END AS status

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
                OR (
                  EXISTS (
                    SELECT 1 FROM public."client_stage_subtasks" st
                    WHERE st.client_stage_id = cs.client_stage_id
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM public."client_stage_subtasks" st
                    WHERE st.client_stage_id = cs.client_stage_id
                      AND st.status <> 'Completed'
                  )
                )
              )
          ) AS completed_stages

        FROM "ClientWithStage" cws
      ),

      "FilteredClients" AS (
        SELECT *
        FROM "ClientStageProgress"
        WHERE $2 = 'ALL' OR status = $2
      )

      SELECT
        fc.client_id,
        fc.client_name,
        fc.code,
        fc.client_status,
        fc.status,
        fc.sla_number,
        fc.primary_contact_first_name,
        fc.primary_contact_last_name,
        fc.primary_contact_name,
        fc.primary_contact_email,
        fc.primary_contact_phone,
        fc.created_at,
        fc.updated_at,

        fc.service_center_id,
        fc.service_center_name,
        sc.email AS service_center_email,

        fc.cpa_id,
        fc.cpa_name,
        cp.email AS cpa_email,

        fc.stage_name,

        fc.total_stages,
        fc.completed_stages,

        lm.created_at AS last_message_at,
        lm.body AS last_message_body,
        lm.sender_role AS last_message_sender_role,

        CASE 
          WHEN fc.total_stages = 0 THEN 0
          ELSE (fc.completed_stages * 100.0) / fc.total_stages
        END AS progress,

        fc.is_archived

      FROM "FilteredClients" fc
      LEFT JOIN public."service_centers" sc
        ON sc.service_center_id = fc.service_center_id
      LEFT JOIN public."cpa_centers" cp
        ON cp.cpa_id = fc.cpa_id
      LEFT JOIN LATERAL (
        SELECT m.created_at, m.body, m.sender_role
        FROM public."onboarding_messages" m
        WHERE m.client_id = fc.client_id
          AND (
            (m.sender_role = 'ADMIN' AND m.receiver_role = 'CLIENT')
            OR (m.sender_role = 'CLIENT' AND m.receiver_role = 'ADMIN')
          )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) lm ON true
      ORDER BY 
        fc.is_archived ASC,
        CASE WHEN $1 <> '' THEN
          CASE 
            WHEN fc.client_name ILIKE $1 THEN 1
            WHEN fc.client_name ILIKE $1 || '%' THEN 2
            WHEN fc.client_name ILIKE '%' || $1 || '%' THEN 3
            WHEN fc.code ILIKE '%' || $1 || '%' THEN 4
            WHEN fc.primary_contact_name ILIKE '%' || $1 || '%' THEN 5
            ELSE 6
          END
        ELSE 0 END,
        COALESCE(lm.created_at, fc.created_at) DESC
      OFFSET $4 LIMIT $5
    `, [q, statusFilter, archiveFilter, offset, pageSize]);

    // Total count query (with same filters)
    const countResult = await pool.query(`
      WITH "ClientBase" AS (
        SELECT
          c.client_id
        FROM public."Clients" c
        LEFT JOIN public."service_centers" sc ON sc.service_center_id = c.service_center_id
        LEFT JOIN public."cpa_centers" cp ON cp.cpa_id = c.cpa_id
        WHERE
          (
            $3 = 'ALL' 
            OR ($3 = 'active' AND COALESCE(c.is_archived, false) = false)
            OR ($3 = 'archived' AND c.is_archived = true)
          )
          AND (
            $1 = '' OR
            c.client_name ILIKE '%' || $1 || '%' OR
            c.code ILIKE '%' || $1 || '%' OR
            c.primary_contact_name ILIKE '%' || $1 || '%' OR
            sc.center_name ILIKE '%' || $1 || '%' OR
            cp.cpa_name ILIKE '%' || $1 || '%'
          )
      ),
      "ClientWithStatus" AS (
        SELECT
          cb.client_id,
          CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM public."client_stages" cs
              WHERE cs.client_id = cb.client_id
            ) THEN 'Not Started'
            WHEN NOT EXISTS (
              SELECT 1 FROM public."client_stages" cs
              WHERE cs.client_id = cb.client_id
                AND cs.status <> 'Completed'
            ) THEN 'Completed'
            WHEN NOT EXISTS (
              SELECT 1 FROM public."client_stages" cs
              WHERE cs.client_id = cb.client_id
                AND cs.status <> 'Not Started'
            ) THEN 'Not Started'
            ELSE 'In Progress'
          END AS status
        FROM "ClientBase" cb
      )
      SELECT COUNT(*) AS total
      FROM "ClientWithStatus"
      WHERE $2 = 'ALL' OR status = $2
    `, [q, statusFilter, archiveFilter]);

    const rows = result.rows || [];
    const total = parseInt(countResult.rows[0]?.total ?? '0');

    return NextResponse.json({
      success: true,
      data: rows,
      page,
      pageSize,
      total,
    });

  } catch (err) {
    console.error("GET /api/clients/get error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}
