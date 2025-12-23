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
    const offset = (page - 1) * pageSize;

    const request = pool
      .request()
      .input("Q", sql.VarChar(255), q)
      .input("PageSize", sql.Int, pageSize)
      .input("Offset", sql.Int, offset);

    const result = await request.query(`

      SET NOCOUNT ON;

      /* ============================================
         STEP 1 — BASE CLIENT QUERY (search + paging)
      ==============================================*/
      WITH ClientBase AS (
        SELECT
          c.client_id,
          c.client_name,
          c.code,
          c.client_status,
          c.sla_number,
          c.primary_contact_name,
          c.primary_contact_email,
          c.primary_contact_phone,
          c.created_at,
          c.updated_at,
          c.service_center_id,
          c.cpa_id
        FROM dbo.Clients c
        WHERE
          @Q = '' OR
          c.client_name LIKE '%' + @Q + '%' OR
          c.code LIKE '%' + @Q + '%' OR
          c.primary_contact_name LIKE '%' + @Q + '%'
      ),
      ClientWithStage AS (
      SELECT
        cb.*,

        stage_name = COALESCE(
          -- ✅ 1. In Progress Stage
          (
            SELECT TOP 1 cs.stage_name
            FROM dbo.client_stages cs
            WHERE cs.client_id = cb.client_id
              AND cs.status = 'In Progress'
            ORDER BY cs.order_number
          ),

          -- ✅ 2. Last Completed Stage
          (
            SELECT TOP 1 cs.stage_name
            FROM dbo.client_stages cs
            WHERE cs.client_id = cb.client_id
              AND cs.status = 'Completed'
            ORDER BY cs.order_number DESC
          ),

          -- ✅ 3. First Not Started Required Stage
          (
            SELECT TOP 1 cs.stage_name
            FROM dbo.client_stages cs
            WHERE cs.client_id = cb.client_id
              AND cs.status = 'Not Started'
              AND cs.is_required = 1
            ORDER BY cs.order_number
          )
        ),

        -- ✅ ✅ ✅ FINAL CLIENT STATUS LOGIC (THIS FIXES YOUR STATUS COLUMN)
        status =
          CASE
            -- ✅ ✅ 1. NO STAGES AT ALL → MUST BE NOT STARTED
            WHEN NOT EXISTS (
              SELECT 1 FROM dbo.client_stages cs
              WHERE cs.client_id = cb.client_id
            ) THEN 'Not Started'

            -- ✅ ✅ 2. ALL STAGES COMPLETED
            WHEN NOT EXISTS (
              SELECT 1 FROM dbo.client_stages cs
              WHERE cs.client_id = cb.client_id
                AND cs.status <> 'Completed'
            ) THEN 'Completed'

            -- ✅ ✅ 3. ALL STAGES NOT STARTED
            WHEN NOT EXISTS (
              SELECT 1 FROM dbo.client_stages cs
              WHERE cs.client_id = cb.client_id
                AND cs.status <> 'Not Started'
            ) THEN 'Not Started'

            -- ✅ ✅ 4. MIXED (Completed + In Progress + Not Started)
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
      )

            /* ============================================
         FINAL SELECT — RECORDSET[0]
      ==============================================*/
      SELECT
        ctp.client_id,
        ctp.client_name,
        ctp.code,
        ctp.client_status,
        ctp.status,
        ctp.sla_number,
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

        ctp.stage_name,


        ctp.total_stages,
        ctp.completed_stages,

        progress =
          CASE 
            WHEN ctp.total_stages = 0 THEN 0
            ELSE (ctp.completed_stages * 100.0) / ctp.total_stages
          END


      FROM ClientStageProgress ctp
      LEFT JOIN dbo.service_centers sc
        ON sc.service_center_id  = ctp.service_center_id
      LEFT JOIN dbo.cpa_centers cp
        ON cp.cpa_id = ctp.cpa_id
      ORDER BY ctp.created_at DESC
      OFFSET @Offset ROWS
      FETCH NEXT @PageSize ROWS ONLY;

      /* ============================================
         TOTAL COUNT — RECORDSET[1]
      ==============================================*/
      SELECT COUNT(*) AS total
      FROM dbo.Clients c
      WHERE
        @Q = '' OR
        c.client_name LIKE '%' + @Q + '%' OR
        c.code LIKE '%' + @Q + '%' OR
        c.primary_contact_name LIKE '%' + @Q + '%';
    `);

    /* ============================================
       FIX — CLEAN RECORDSETS EXTRACTION
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
