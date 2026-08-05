import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TAB_ALIASES: Record<string, string> = {
  settings: "overview",
  reports: "analytics",
};

const VALID_TABS = new Set([
  "home",
  "calendar",
  "team",
  "services",
  "hours",
  "analytics",
  "overview",
  ...Object.keys(TAB_ALIASES),
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/Dashboard") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const match = pathname.match(/^\/dashboard\/([^/]+)\/?$/i);
  if (match) {
    const raw = match[1].toLowerCase();
    if (VALID_TABS.has(raw)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("tab", TAB_ALIASES[raw] ?? raw);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/Dashboard", "/dashboard/:path*"],
};
