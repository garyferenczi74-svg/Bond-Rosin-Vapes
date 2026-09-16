import { NextResponse, type NextRequest } from "next/server";
import { isCloakedStaticPath } from "@/lib/access";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isCloakedStaticPath(pathname) || pathname.startsWith("/bond-brain")) {
    const cloak = request.nextUrl.clone();
    cloak.pathname = "/cloaked-404";
    return NextResponse.rewrite(cloak);
  }

  return (await updateSession(request)).response;
}

export const config = {
  matcher: [
    "/haus",
    "/haus/:path*",
    "/vauxhall",
    "/vauxhall/:path*",
    "/Admin.dc.html",
    "/Vauxhall.dc.html",
    "/Haus.dc.html",
    "/HausAdmin.dc.html",
    "/Product.dc.html",
    "/Security.dc.html",
    "/Social.dc.html",
    "/bond-brain",
    "/bond-brain/:path*",
  ],
};
