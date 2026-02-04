// app/api/clients/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(req: Request) {
  try {
    const pool = await getDbPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
    const pageSize = Math.max(parseInt(searchParams.get("pageSize") || "10"), 1);
    const q = (searchParams.get("q") || "").trim();
    // Status filter: ALL, Not Started, In Progress, Completed
    const statusFilter = (searchParams.get("status") || "ALL").trim();
    // Archive filter: ALL (both), active (not archived), archived (only archived)
    const archiveFilter = (searchParams.get("archiveFilter") || "ALL").trim();
    const offset = (page - 1) * pageSize;

    const request = pool
      .request()
      .input("Q", sql.VarChar(255), q)
      .input("StatusFilter", sql.VarChar(50), statusFilter)
      .input("ArchiveFilter", sql.VarChar(50), archiveFilter)
      .input("PageSize", sql.Int, pageSize)
      .input("Offset", sql.Int, offset);

    const result = await request.query(`

      SET NOCOUNT ON;

      /* ============================================
         STEP 1 — BASE CLIENT QUERY (search filter)
         Joins service centers and CPAs early for search
      ==============================================*/
      WITH ClientBase AS (
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
          ISNULL(c.is_archived, 0) AS is_archived,
          sc.center_name AS service_center_name,
          cp.cpa_name AS cpa_name
        FROM dbo.Clients c
        LEFT JOIN dbo.service_centers sc ON sc.service_center_id = c.service_center_id
        LEFT JOIN dbo.cpa_centers cp ON cp.cpa_id = c.cpa_id
        WHERE
          -- Archive filter
          (
            @ArchiveFilter = 'ALL' 
            OR (@ArchiveFilter = 'active' AND ISNULL(c.is_archived, 0) = 0)
            OR (@ArchiveFilter = 'archived' AND c.is_archived = 1)
          )
          AND (
            @Q = '' OR
            c.client_name LIKE '%' + @Q + '%' OR
            c.code LIKE '%' + @Q + '%' OR
            c.primary_contact_name LIKE '%' + @Q + '%' OR
            sc.center_name LIKE '%' + @Q + '%' OR
            cp.cpa_name LIKE '%' + @Q + '%'
          )
      ),

      /* ============================================
         STEP 2 — COMPUTE STAGE NAME AND STATUS
      ==============================================*/
      ClientWithStage AS (
        SELECT
          cb.*,

          stage_name = COALESCE(
            -- 1. In Progress Stage
            (
              SELECT TOP 1 cs.stage_name
              FROM dbo.client_stages cs
              WHERE cs.client_id = cb.client_id
                AND cs.status = 'In Progress'
              ORDER BY cs.order_number
            ),

            -- 2. Last Completed Stage
            (
              SELECT TOP 1 cs.stage_name
              FROM dbo.client_stages cs
              WHERE cs.client_id = cb.client_id
                AND cs.status = 'Completed'
              ORDER BY cs.order_number DESC
            ),

            -- 3. First Not Started Required Stage
            (
              SELECT TOP 1 cs.stage_name
              FROM dbo.client_stages cs
              WHERE cs.client_id = cb.client_id
                AND cs.status = 'Not Started'
                AND cs.is_required = 1
              ORDER BY cs.order_number
            )
          ),

          -- FINAL CLIENT STATUS LOGIC
          status =
            CASE
              -- 1. NO STAGES AT ALL → NOT STARTED
              WHEN NOT EXISTS (
                SELECT 1 FROM dbo.client_stages cs
                WHERE cs.client_id = cb.client_id
              ) THEN 'Not Started'

              -- 2. ALL STAGES COMPLETED
              WHEN NOT EXISTS (
                SELECT 1 FROM dbo.client_stages cs
                WHERE cs.client_id = cb.client_id
                  AND cs.status <> 'Completed'
              ) THEN 'Completed'

              -- 3. ALL STAGES NOT STARTED
              WHEN NOT EXISTS (
                SELECT 1 FROM dbo.client_stages cs
                WHERE cs.client_id = cb.client_id
                  AND cs.status <> 'Not Started'
              ) THEN 'Not Started'

              -- 4. MIXED (Completed + In Progress + Not Started)
              ELSE 'In Progress'
            END

        FROM ClientBase cb
      ),

      /* ============================================
         STEP 3 — STAGE PROGRESS (STAGE + SUBTASK LOGIC)
      ==============================================*/
      ClientStageProgress AS (
        SELECT
          cws.*,

          total_stages = (
            SELECT COUNT(*)
            FROM dbo.client_stages cs
            WHERE cs.client_id = cws.client_id
          ),

          completed_stages = (
            SELECT COUNT(*)
            FROM dbo.client_stages cs
            WHERE cs.client_id = cws.client_id
              AND (
                cs.status = 'Completed'
                OR (
                  -- Stage has subtasks AND all subtasks are completed
                  EXISTS (
                    SELECT 1 FROM dbo.client_stage_subtasks st
                    WHERE st.client_stage_id = cs.client_stage_id
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.client_stage_subtasks st
                    WHERE st.client_stage_id = cs.client_stage_id
                      AND st.status <> 'Completed'
                  )
                )
              )
          )

        FROM ClientWithStage cws
      ),

      /* ============================================
         STEP 4 — APPLY STATUS FILTER
      ==============================================*/
      FilteredClients AS (
        SELECT *
        FROM ClientStageProgress
        WHERE @StatusFilter = 'ALL' OR status = @StatusFilter
      )

      /* ============================================
         FINAL SELECT — RECORDSET[0]
      ==============================================*/
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

        last_message_at = LastMsg.created_at,
        last_message_body = LastMsg.body,
        last_message_sender_role = LastMsg.sender_role,

        progress =
          CASE 
            WHEN fc.total_stages = 0 THEN 0
            ELSE (fc.completed_stages * 100.0) / fc.total_stages
          END,

        fc.is_archived

      FROM FilteredClients fc
      LEFT JOIN dbo.service_centers sc
        ON sc.service_center_id = fc.service_center_id
      LEFT JOIN dbo.cpa_centers cp
        ON cp.cpa_id = fc.cpa_id
      OUTER APPLY (
        SELECT TOP 1 m.created_at, m.body, m.sender_role
        FROM dbo.onboarding_messages m
        WHERE m.client_id = fc.client_id
          -- Only fetch messages from Admin-Client conversation thread
          AND (
            (m.sender_role = 'ADMIN' AND m.receiver_role = 'CLIENT')
            OR (m.sender_role = 'CLIENT' AND m.receiver_role = 'ADMIN')
          )
        ORDER BY m.created_at DESC
      ) LastMsg
      ORDER BY 
        -- Archived clients always at bottom
        fc.is_archived ASC,
        -- When searching, sort by relevance (exact client_name matches first)
        CASE WHEN @Q <> '' THEN
          CASE 
            -- Exact client name match (highest priority)
            WHEN fc.client_name LIKE @Q THEN 1
            -- Client name starts with search term
            WHEN fc.client_name LIKE @Q + '%' THEN 2
            -- Client name contains search term
            WHEN fc.client_name LIKE '%' + @Q + '%' THEN 3
            -- Code matches
            WHEN fc.code LIKE '%' + @Q + '%' THEN 4
            -- Primary contact matches
            WHEN fc.primary_contact_name LIKE '%' + @Q + '%' THEN 5
            -- Service center / CPA matches (lowest priority)
            ELSE 6
          END
        ELSE 0 END,
        -- Sort by most recent message, then created_at
        COALESCE(LastMsg.created_at, fc.created_at) DESC
      OFFSET @Offset ROWS
      FETCH NEXT @PageSize ROWS ONLY;

      /* ============================================
         TOTAL COUNT (with same filters) — RECORDSET[1]
      ==============================================*/
      ;WITH ClientBase AS (
        SELECT
          c.client_id
        FROM dbo.Clients c
        LEFT JOIN dbo.service_centers sc ON sc.service_center_id = c.service_center_id
        LEFT JOIN dbo.cpa_centers cp ON cp.cpa_id = c.cpa_id
        WHERE
          -- Archive filter
          (
            @ArchiveFilter = 'ALL' 
            OR (@ArchiveFilter = 'active' AND ISNULL(c.is_archived, 0) = 0)
            OR (@ArchiveFilter = 'archived' AND c.is_archived = 1)
          )
          AND (
            @Q = '' OR
            c.client_name LIKE '%' + @Q + '%' OR
            c.code LIKE '%' + @Q + '%' OR
            c.primary_contact_name LIKE '%' + @Q + '%' OR
            sc.center_name LIKE '%' + @Q + '%' OR
            cp.cpa_name LIKE '%' + @Q + '%'
          )
      ),
      ClientWithStatus AS (
        SELECT
          cb.client_id,
          status =
            CASE
              WHEN NOT EXISTS (
                SELECT 1 FROM dbo.client_stages cs
                WHERE cs.client_id = cb.client_id
              ) THEN 'Not Started'

              WHEN NOT EXISTS (
                SELECT 1 FROM dbo.client_stages cs
                WHERE cs.client_id = cb.client_id
                  AND cs.status <> 'Completed'
              ) THEN 'Completed'

              WHEN NOT EXISTS (
                SELECT 1 FROM dbo.client_stages cs
                WHERE cs.client_id = cb.client_id
                  AND cs.status <> 'Not Started'
              ) THEN 'Not Started'

              ELSE 'In Progress'
            END
        FROM ClientBase cb
      )
      SELECT COUNT(*) AS total
      FROM ClientWithStatus
      WHERE @StatusFilter = 'ALL' OR status = @StatusFilter;
    `);

    /* ============================================
       CLEAN RECORDSETS EXTRACTION
    ==============================================*/
    const recordsets = Array.isArray(result.recordsets)
      ? (result.recordsets as sql.IRecordSet<any>[])
      : [];

    const rows = recordsets[0] || [];
    const total = recordsets[1]?.[0]?.total ?? 0;

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

