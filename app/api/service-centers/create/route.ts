// app/api/service-centers/create/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Center name is required" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 1️⃣ Generate Next Center Code (SC001, SC002...)
    const maxResult = await pool.request().query(`
      SELECT ISNULL(MAX(service_center_id), 0) AS maxId
      FROM dbo.service_centers;
    `);

    const nextId = maxResult.recordset[0].maxId + 1;
    const centerCode = `SC${String(nextId).padStart(3, "0")}`;

    // 2️⃣ Insert into service_centers
    const insertResult = await pool.request()
      .input("name", sql.NVarChar, name)
      .input("email", sql.NVarChar, email)
      .input("code", sql.NVarChar, centerCode)
      .query(`
        INSERT INTO dbo.service_centers (center_name, email, center_code)
        OUTPUT INSERTED.service_center_id
        VALUES (@name, @email, @code)
      `);

    const centerId = insertResult.recordset[0].service_center_id;

    return NextResponse.json({
      success: true,
      center_id: centerId,
      center_code: centerCode,
      message: "Service Center created successfully",
    });

  } catch (err: any) {
    console.error("CREATE SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
