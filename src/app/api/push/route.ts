import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getVapid, notify } from "@/lib/notify";

const subSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** กุญแจสาธารณะสำหรับสมัครรับแจ้งเตือน */
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  return NextResponse.json({ publicKey: (await getVapid()).publicKey });
}

/** สมัครรับแจ้งเตือน (ส่ง test: true เพื่อส่งข้อความทดสอบ) */
export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.test) {
    await notify([u.id], { kind: "system", title: "ทดสอบการแจ้งเตือน", body: "ถ้าเห็นข้อความนี้ แปลว่ามือถือเครื่องนี้รับแจ้งเตือนจาก KIN HR ได้แล้ว", href: "/notifications" });
    return NextResponse.json({ ok: true });
  }
  const r = subSchema.safeParse(body?.subscription);
  if (!r.success) return NextResponse.json({ error: "ข้อมูลการสมัครไม่ถูกต้อง" }, { status: 400 });
  const values = { userId: u.id, endpoint: r.data.endpoint, p256dh: r.data.keys.p256dh, auth: r.data.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null };
  await db.insert(pushSubscriptions).values(values).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  return NextResponse.json({ ok: true });
}

/** ยกเลิกรับแจ้งเตือนบนเครื่องนี้ */
export async function DELETE(req: Request) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const endpoint = String((await req.json().catch(() => ({})))?.endpoint ?? "");
  if (endpoint) await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, u.id)));
  return NextResponse.json({ ok: true });
}
