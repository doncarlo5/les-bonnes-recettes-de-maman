import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale } from "@/i18n/config";

const PUBLIC_FILE = /\.(.*)$/;
// Extensionless metadata routes served at the app root (Next file conventions).
// Routes with an extension (icon.svg, manifest.webmanifest, robots.txt,
// sitemap.xml) are already covered by PUBLIC_FILE.
const ROOT_METADATA_ROUTES = new Set(["/apple-icon", "/icon"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    ROOT_METADATA_ROUTES.has(pathname) ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const firstSegment = pathname.split("/")[1];

  if (hasLocale(firstSegment)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next).*)"],
};
