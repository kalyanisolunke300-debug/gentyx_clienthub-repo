import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("clientId", sql.Int, id)
      .query(`

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
        WHERE c.client_id = @clientId
      ),

      ClientWithStage AS (
        SELECT
          cb.*,

          stage_id = (
            SELECT TOP 1 cs.client_stage_id
            FROM dbo.client_stages cs
            WHERE cs.client_id = cb.client_id
            ORDER BY cs.order_number
          ),

          stage_name = (
            SELECT TOP 1 cs.stage_name
            FROM dbo.client_stages cs
            WHERE cs.client_id = cb.client_id
            ORDER BY cs.order_number
          )

        FROM ClientBase cb
      ),

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
                OR NOT EXISTS (
                  SELECT 1
                  FROM dbo.client_stage_subtasks st
                  WHERE st.client_stage_id = cs.client_stage_id
                    AND st.status <> 'Completed'
                )
              )
          )
        FROM ClientWithStage cws
      )

      SELECT
    ctp.client_id,
    ctp.client_name,
    ctp.code,
    ctp.client_status,
    ctp.client_status AS status,
    ctp.sla_number,
    ctp.primary_contact_name,
    ctp.primary_contact_email,
    ctp.primary_contact_phone,
    ctp.created_at,
    ctp.updated_at,

    ctp.service_center_id,
    sc.center_name AS service_center_name,

    ctp.cpa_id,
    cp.cpa_name AS cpa_name,

    ctp.stage_id,
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
    ON sc.service_center_id = ctp.service_center_id
  LEFT JOIN dbo.cpa_centers cp
    ON cp.cpa_id = ctp.cpa_id;

      `);

    const row = result.recordset[0];

    if (!row) {
      return NextResponse.json(
        { success: false, error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: row,
    });

  } catch (err) {
    console.error("GET client error:", err);

    return NextResponse.json(
      { success: false, error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}
