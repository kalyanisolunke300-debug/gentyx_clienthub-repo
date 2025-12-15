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
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
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


    return response;

  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
