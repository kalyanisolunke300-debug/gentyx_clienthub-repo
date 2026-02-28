// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

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

    const result = await pool.query(`
        SELECT id, email, password, role
        FROM public."Users"
        WHERE email = $1
        LIMIT 1
      `, [email]);

    const user = result.rows[0];

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

      const clientResult = await pool.query(`
            SELECT client_id
            FROM public."Clients"
            WHERE primary_contact_email = $1
            LIMIT 1
          `, [user.email]);

      console.log("🔍 LOGIN API - Query result:", clientResult.rows);

      if (clientResult.rows.length > 0) {
        clientId = clientResult.rows[0].client_id;
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

      const scResult = await pool.query(`
            SELECT service_center_id
            FROM public."service_centers"
            WHERE email = $1
            LIMIT 1
          `, [user.email]);

      console.log("🔍 LOGIN API - SC Query result:", scResult.rows);

      if (scResult.rows.length > 0) {
        serviceCenterId = scResult.rows[0].service_center_id;
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

      const cpaResult = await pool.query(`
            SELECT cpa_id
            FROM public."cpa_centers"
            WHERE email = $1
            LIMIT 1
          `, [user.email]);

      console.log("🔍 LOGIN API - CPA Query result:", cpaResult.rows);

      if (cpaResult.rows.length > 0) {
        cpaId = cpaResult.rows[0].cpa_id;
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("clienthub_role", user.role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("clienthub_issuedAt", Date.now().toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    if (clientId) {
      console.log("🔍 LOGIN API - Setting clienthub_clientId cookie to:", clientId);
      response.cookies.set("clienthub_clientId", clientId.toString(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    if (serviceCenterId) {
      console.log("🔍 LOGIN API - Setting clienthub_serviceCenterId cookie to:", serviceCenterId);
      response.cookies.set("clienthub_serviceCenterId", serviceCenterId.toString(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    if (cpaId) {
      console.log("🔍 LOGIN API - Setting clienthub_cpaId cookie to:", cpaId);
      response.cookies.set("clienthub_cpaId", cpaId.toString(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
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
