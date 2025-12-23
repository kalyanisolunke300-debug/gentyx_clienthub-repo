// // app/api/login/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { getDbPool } from "@/lib/db";
// import sql from "mssql";

// export async function POST(req: NextRequest) {
//   try {
//     const { email, password } = await req.json();

//     if (!email || !password) {
//       return NextResponse.json(
//         { success: false, message: "Email and password are required." },
//         { status: 400 }
//       );
//     }

//     const pool = await getDbPool();

//     const result = await pool
//       .request()
//       .input("email", sql.NVarChar, email)
//       .query(`
//         SELECT TOP 1 id, email, password, role
//         FROM Users
//         WHERE email = @email
//       `);

//     const user = result.recordset[0];

//     if (!user || user.password !== password) {
//       return NextResponse.json(
//         { success: false, message: "Invalid email or password." },
//         { status: 401 }
//       );
//     }

//     // --- CREATE COOKIES ---
//     const response = NextResponse.json({
//       success: true,
//       user: {
//         id: user.id,
//         email: user.email,
//         role: user.role,
//       },
//     });

//     // Cookie: Token (use user.id for now)
//     response.cookies.set("clienthub_token", user.id.toString(), {
//       httpOnly: true,
//       secure: false,
//       sameSite: "lax",
//       path: "/",
//     });

//     response.cookies.set("clienthub_role", user.role, {
//       httpOnly: true,
//       secure: false,
//       sameSite: "lax",
//       path: "/",
//     });

//     response.cookies.set("clienthub_issuedAt", Date.now().toString(), {
//       httpOnly: true,
//       secure: false,
//       sameSite: "lax",
//       path: "/",
//     });


//     return response;

//   } catch (error) {
//     console.error("Login API error:", error);
//     return NextResponse.json(
//       { success: false, message: "Internal server error." },
//       { status: 500 }
//     );
//   }
// }
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

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId, // 👈 IMPORTANT
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
        httpOnly: false, // 👈 MUST be false so JavaScript can read it!
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
