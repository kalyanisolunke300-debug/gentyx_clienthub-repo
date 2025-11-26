// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // ❌ Remove role requirement – now role comes from DB
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 🔍 Get user by email ONLY
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query(`
        SELECT TOP 1 id, email, password, role
        FROM Users
        WHERE email = @email
      `);

    const user = result.recordset[0];

    // ❌ If no user found
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    // ❌ Compare password (plain text for now)
    if (user.password !== password) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    // ✅ Return role from DB
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role, // ← This determines the dashboard redirect
      },
    });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
