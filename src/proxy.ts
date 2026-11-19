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
  // ยกเว้นหน้า login, API, ไฟล์ของ Next และไฟล์ที่มีนามสกุล (รูป โลโก้ manifest) ไม่ต้องล็อกอินก็โหลดได้
  matcher: ["/((?!login|api|_next|.*\\..*).*)"],
};
