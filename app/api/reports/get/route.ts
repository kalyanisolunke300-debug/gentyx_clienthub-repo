// app/api/reports/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fromDate = null, toDate = null, serviceCenter = null, cpa = null, stage = null, status = null } = body;
    const pool = await getDbPool();

    const result = await pool.query(`
      SELECT c.client_id, c.client_name, c.code, c.client_status, c.stage_id, s.stage_name,
        c.progress, sc.center_name AS service_center, ca.cpa_name AS cpa, c.created_at,
        SUM(CASE WHEN t.status = 'Pending' THEN 1 ELSE 0 END) AS pending_tasks,
        SUM(CASE WHEN t.status = 'In Review' THEN 1 ELSE 0 END) AS inreview_tasks,
        SUM(CASE WHEN t.status = 'Approved' THEN 1 ELSE 0 END) AS approved_tasks,
        SUM(CASE WHEN t.status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_tasks
      FROM public."Clients" c
      LEFT JOIN public."onboarding_stages" s ON s.stage_id = c.stage_id
      LEFT JOIN public."onboarding_tasks" t ON t.client_id = c.client_id
      LEFT JOIN public."service_centers" sc ON sc.service_center_id = c.service_center_id
      LEFT JOIN public."cpa_centers" ca ON ca.cpa_id = c.cpa_id
      WHERE 1 = 1
        AND ($1::timestamp IS NULL OR c.created_at >= $1::timestamp)
        AND ($2::timestamp IS NULL OR c.created_at <= $2::timestamp)
        AND ($3::int IS NULL OR c.service_center_id = $3)
        AND ($4::int IS NULL OR c.cpa_id = $4)
        AND ($5::int IS NULL OR c.stage_id = $5)
        AND ($6::text IS NULL OR c.client_status = $6)
      GROUP BY c.client_id, c.client_name, c.code, c.client_status, c.stage_id, s.stage_name,
        c.progress, sc.center_name, ca.cpa_name, c.created_at
      ORDER BY c.created_at DESC
    `, [fromDate, toDate, serviceCenter, cpa, stage, status]);

    return NextResponse.json({ success: true, clients: result.rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
