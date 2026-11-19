import { NextResponse, type NextRequest } from "next/server";

/** เช็คแบบเร็ว: ไม่มี session cookie → ไปหน้า login (การตรวจสิทธิ์จริงทำในหน้า/route ด้วย requireUser) */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("hr_session")) {
    const url = new URL("/login", req.url);
    if (req.nextUrl.pathname !== "/") url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api|_next|icon.svg|manifest.webmanifest|favicon.ico).*)"],
};
