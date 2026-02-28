// app/api/service-centers/[id]/get/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request, { params }: any) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    const pool = await getDbPool();

    const center = await pool.query(`
        SELECT service_center_id AS id, center_name AS name, center_code AS code, email, created_at, updated_at
        FROM public."service_centers"
        WHERE service_center_id = $1
      `, [numericId]);

    return NextResponse.json({ success: true, data: center.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}