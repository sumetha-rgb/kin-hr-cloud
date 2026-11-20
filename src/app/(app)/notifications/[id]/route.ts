import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/** แตะการแจ้งเตือน → ทำเครื่องหมายอ่านแล้ว แล้วพาไปหน้าที่เกี่ยวข้อง */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.redirect(new URL("/login", req.url));
  const id = Number((await params).id);
  const [n] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, u.id)))
    .returning({ href: notifications.href });
  const href = n?.href && n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/notifications";
  return NextResponse.redirect(new URL(href, req.url));
}
