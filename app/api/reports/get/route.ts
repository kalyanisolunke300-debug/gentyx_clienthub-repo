// app/api/reports/get/route.ts

import { NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      fromDate = null,
      toDate = null,
      serviceCenter = null,
      cpa = null,
      stage = null,
      status = null,
    } = body;

    const pool = await getDbPool();

    const result = await pool.request()
      .input("FromDate", sql.DateTime, fromDate)
      .input("ToDate", sql.DateTime, toDate)
      .input("ServiceCenter", sql.Int, serviceCenter)
      .input("CPA", sql.Int, cpa)
      .input("Stage", sql.Int, stage)
      .input("Status", sql.VarChar, status)
      .query(`
        SELECT 
            c.client_id,
            c.client_name,
            c.code,
            c.client_status,
            c.stage_id,
            s.stage_name,
            c.progress,
            sc.center_name AS service_center,
            ca.cpa_name AS cpa,
            c.created_at,

            -- Task Summary
            SUM(CASE WHEN t.status = 'Pending' THEN 1 ELSE 0 END) AS pending_tasks,
            SUM(CASE WHEN t.status = 'In Review' THEN 1 ELSE 0 END) AS inreview_tasks,
            SUM(CASE WHEN t.status = 'Approved' THEN 1 ELSE 0 END) AS approved_tasks,
            SUM(CASE WHEN t.status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_tasks

        FROM Clients c
        LEFT JOIN onboarding_stages s ON s.stage_id = c.stage_id
        LEFT JOIN onboarding_tasks t ON t.client_id = c.client_id
        LEFT JOIN service_centers sc ON sc.service_center_id = c.service_center_id
        LEFT JOIN cpa_centers ca ON ca.cpa_id = c.cpa_id

        WHERE 1 = 1
            AND (@FromDate IS NULL OR c.created_at >= @FromDate)
            AND (@ToDate IS NULL OR c.created_at <= @ToDate)
            AND (@ServiceCenter IS NULL OR c.service_center_id = @ServiceCenter)
            AND (@CPA IS NULL OR c.cpa_id = @CPA)
            AND (@Stage IS NULL OR c.stage_id = @Stage)
            AND (@Status IS NULL OR c.client_status = @Status)

        GROUP BY
            c.client_id, c.client_name, c.code, c.client_status,
            c.stage_id, s.stage_name,
            c.progress,
            sc.center_name,
            ca.cpa_name,
            c.created_at

        ORDER BY c.created_at DESC;
      `);

    return NextResponse.json({
      success: true,
      clients: result.recordset,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
