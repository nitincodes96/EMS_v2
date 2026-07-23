import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDashboardPath } from "@/lib/role-routes";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Try to fetch the organization status
  let organizationExists = true; // default to true to fail safe
  try {
    const url = new URL("/api/organization-exists", request.url);
    const response = await fetch(url.toString(), {
      // Short cache or no-store, depending on needs. We can use no-store to be safe.
      cache: "no-store",
    });
    
    if (response.ok) {
      const data = await response.json();
      organizationExists = data.exists;
    }
  } catch (err) {
    console.error("Middleware fetch error:", err);
  }

  // Get user session via NextAuth token
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token;

  let isActiveSession = isAuthenticated;
  try {
    if (isAuthenticated) {
      const statusResponse = await fetch(new URL("/api/auth/session-status", request.url).toString(), {
        cache: "no-store",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        isActiveSession = !!statusData.authenticated && !!statusData.isActive;
      } else {
        isActiveSession = false;
      }
    }
  } catch (err) {
    console.error("Middleware session status fetch error:", err);
    isActiveSession = false;
  }
  
  // Logic: Organization Doesn't Exist
  if (!organizationExists) {
    // Only allow access to register and verify. If not on those, redirect to register
    if (pathname !== "/register" && pathname !== "/verify") {
      return NextResponse.redirect(new URL("/register", request.url));
    }
    return NextResponse.next();
  }

  // Logic: Organization Exists
  // If organization exists, they shouldn't access the register page
  if (organizationExists && pathname === "/register") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If not authenticated and trying to access a protected route (anything other than login, register, verify)
  const publicUnauthenticatedPaths = ["/login", "/verify", "/forgot-password", "/reset-password"];
  if (!isAuthenticated && !publicUnauthenticatedPaths.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If authenticated and trying to access login, redirect to dashboard
  if (isAuthenticated && isActiveSession && pathname === "/login") {
    return NextResponse.redirect(new URL(getDashboardPath(token.role as string), request.url));
  }

  if (isAuthenticated && !isActiveSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "ACCOUNT_DEACTIVATED");
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and trying to access root `/`, redirect to dashboard
  if (isAuthenticated && isActiveSession && pathname === "/") {
    return NextResponse.redirect(new URL(getDashboardPath(token.role as string), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (static uploads folder)
     * - static asset files served from /public (svg, png, jpg, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};
