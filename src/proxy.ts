import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isSessionValid } from "./lib/adminSession";

const ADMIN_HOSTNAME = "admin.thedataqualitycompany.com";

// Login and logout have to be reachable without a session - login is how
// you get one, and logout should still clear a stale/expired cookie.
const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/api/admin/login",
  "/api/admin/logout",
]);

function isLocalHost(host: string): boolean {
  const hostname = host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;
  const onAdminHost = host === ADMIN_HOSTNAME;
  const onLocalHost = isLocalHost(host);
  const touchesAdminRoutes =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  // The admin area only exists on the admin hostname (and on localhost, for
  // development). Everywhere else - the public site, *.vercel.app previews -
  // it should look like it was never built.
  if (!onAdminHost && !onLocalHost) {
    if (touchesAdminRoutes) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  // On the admin hostname, the bare "/" serves the admin dashboard while the
  // URL stays "/".
  const effectivePathname =
    onAdminHost && pathname === "/" ? "/admin" : pathname;

  const isAdminApi = effectivePathname.startsWith("/api/admin");
  const isAdminPage = effectivePathname.startsWith("/admin");

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.has(effectivePathname)) {
    return effectivePathname === pathname
      ? NextResponse.next()
      : NextResponse.rewrite(new URL(effectivePathname, request.url));
  }

  const authed = isSessionValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  );

  if (!authed) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return effectivePathname === pathname
    ? NextResponse.next()
    : NextResponse.rewrite(new URL(effectivePathname, request.url));
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/admin/:path*"],
};
