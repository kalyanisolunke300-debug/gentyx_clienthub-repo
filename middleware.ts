// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("clienthub_token")?.value;
  const role = req.cookies.get("clienthub_role")?.value;

  // Allow public routes
  if (
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/api/login")
  ) {
    return NextResponse.next();
  }

  // Block access if not logged in
  if (!token || !role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Role-based protection
  const roleRoutes: Record<string, string> = {
    ADMIN: "/admin",
    CLIENT: "/client",
    SERVICE_CENTER: "/service-center",
    CPA: "/cpa",
  };

  const baseRoute = "/" + req.nextUrl.pathname.split("/")[1];

  // If user tries to open a route of another role — BLOCK it
  if (baseRoute !== roleRoutes[role]) {
    return NextResponse.redirect(new URL(roleRoutes[role], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/client/:path*",
    "/service-center/:path*",
    "/cpa/:path*",
  ],
};
