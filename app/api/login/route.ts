// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query(`
        SELECT TOP 1 id, email, password, role
        FROM Users
        WHERE email = @email
      `);

    const user = result.recordset[0];

    if (!user || user.password !== password) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    // --- CREATE COOKIES ---
    let clientId: number | null = null;
    let serviceCenterId: number | null = null;
    let cpaId: number | null = null;

    // Handle CLIENT role
    if (user.role === "CLIENT") {
      console.log("🔍 LOGIN API - Looking up client for email:", user.email);

      const clientResult = await pool
        .request()
        .input("email", sql.NVarChar, user.email)
        .query(`
            SELECT TOP 1 client_id
            FROM dbo.clients
            WHERE primary_contact_email = @email
          `);

      console.log("🔍 LOGIN API - Query result:", clientResult.recordset);

      if (clientResult.recordset.length > 0) {
        clientId = clientResult.recordset[0].client_id;
        console.log("🔍 LOGIN API - Found clientId:", clientId);
      }

      if (!clientId) {
        console.log("🔍 LOGIN API - No client found for email:", user.email);
        return NextResponse.json(
          { success: false, message: "Client record not linked to this user." },
          { status: 403 }
        );
      }
    }

    // Handle SERVICE_CENTER role
    if (user.role === "SERVICE_CENTER") {
      console.log("🔍 LOGIN API - Looking up service center for email:", user.email);

      const scResult = await pool
        .request()
        .input("email", sql.NVarChar, user.email)
        .query(`
            SELECT TOP 1 service_center_id
            FROM dbo.service_centers
            WHERE email = @email
          `);

      console.log("🔍 LOGIN API - SC Query result:", scResult.recordset);

      if (scResult.recordset.length > 0) {
        serviceCenterId = scResult.recordset[0].service_center_id;
        console.log("🔍 LOGIN API - Found serviceCenterId:", serviceCenterId);
      }

      if (!serviceCenterId) {
        console.log("🔍 LOGIN API - No service center found for email:", user.email);
        return NextResponse.json(
          { success: false, message: "Service Center record not linked to this user." },
          { status: 403 }
        );
      }
    }

    // Handle CPA role
    if (user.role === "CPA") {
      console.log("🔍 LOGIN API - Looking up CPA for email:", user.email);

      const cpaResult = await pool
        .request()
        .input("email", sql.NVarChar, user.email)
        .query(`
            SELECT TOP 1 cpa_id
            FROM dbo.cpa_centers
            WHERE email = @email
          `);

      console.log("🔍 LOGIN API - CPA Query result:", cpaResult.recordset);

      if (cpaResult.recordset.length > 0) {
        cpaId = cpaResult.recordset[0].cpa_id;
        console.log("🔍 LOGIN API - Found cpaId:", cpaId);
      }

      if (!cpaId) {
        console.log("🔍 LOGIN API - No CPA found for email:", user.email);
        return NextResponse.json(
          { success: false, message: "CPA record not linked to this user." },
          { status: 403 }
        );
      }
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId,
        serviceCenterId,
        cpaId,
      },
    });

    // Cookie: Token (use user.id for now)
    response.cookies.set("clienthub_token", user.id.toString(), {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("clienthub_role", user.role, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("clienthub_issuedAt", Date.now().toString(), {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    if (clientId) {
      console.log("🔍 LOGIN API - Setting clienthub_clientId cookie to:", clientId);
      response.cookies.set("clienthub_clientId", clientId.toString(), {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
      });
    }

    if (serviceCenterId) {
      console.log("🔍 LOGIN API - Setting clienthub_serviceCenterId cookie to:", serviceCenterId);
      response.cookies.set("clienthub_serviceCenterId", serviceCenterId.toString(), {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
      });
    }

    if (cpaId) {
      console.log("🔍 LOGIN API - Setting clienthub_cpaId cookie to:", cpaId);
      response.cookies.set("clienthub_cpaId", cpaId.toString(), {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
      });
    }

    return response;

  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
