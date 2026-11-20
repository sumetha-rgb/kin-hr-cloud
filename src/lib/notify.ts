import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { companySettings, notifications, pushSubscriptions, users } from "@/db/schema";
import { getSettings } from "./payroll-run";

export type NoticeKind = "payslip" | "request_new" | "request_decided" | "warning" | "system";
export type Notice = { kind: NoticeKind; title: string; body?: string; href?: string };

/** กุญแจ VAPID: สร้างครั้งแรกแล้วเก็บในฐานข้อมูล (ไม่ต้องตั้ง env ใน Vercel) */
export async function getVapid() {
  const s = await getSettings();
  if (s.vapidPublicKey && s.vapidPrivateKey) return { publicKey: s.vapidPublicKey, privateKey: s.vapidPrivateKey };
  const k = webpush.generateVAPIDKeys();
  // เขียนเฉพาะเมื่อยังว่าง กันสองคำขอสร้างกุญแจทับกัน
  await db
    .update(companySettings)
    .set({ vapidPublicKey: k.publicKey, vapidPrivateKey: k.privateKey })
    .where(and(eq(companySettings.id, 1), isNull(companySettings.vapidPublicKey)));
  const fresh = await getSettings();
  return { publicKey: fresh.vapidPublicKey!, privateKey: fresh.vapidPrivateKey! };
}

/**
 * ส่งแจ้งเตือนถึงผู้ใช้: บันทึกในระบบ (กระดิ่ง) + เด้งบนมือถือที่เปิดรับไว้
 * ห้ามทำให้งานหลักล้ม — ผิดพลาดแค่ log ไว้
 * notice เป็นฟังก์ชันได้ เพื่อให้แต่ละคนได้ลิงก์ของตัวเอง (เช่น สลิปของใครของมัน)
 */
export async function notify(userIds: number[], notice: Notice | ((userId: number) => Notice)) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  try {
    const rows = ids.map((userId) => ({ userId, ...(typeof notice === "function" ? notice(userId) : notice) }));
    await db.insert(notifications).values(rows.map((r) => ({ userId: r.userId, kind: r.kind, title: r.title, body: r.body ?? null, href: r.href ?? null })));
    await sendPush(rows);
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

async function sendPush(rows: Array<{ userId: number } & Notice>) {
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, rows.map((r) => r.userId)));
  if (!subs.length) return;
  const vapid = await getVapid();
  webpush.setVapidDetails("mailto:hr@kinrehab.com", vapid.publicKey, vapid.privateKey);
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  const dead: number[] = [];
  await Promise.allSettled(
    subs.map(async (s) => {
      const n = byUser.get(s.userId)!;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: n.title, body: n.body ?? "", href: n.href ?? "/notifications", tag: n.kind }),
          { TTL: 60 * 60 * 24 },
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id); // ผู้ใช้ยกเลิก/ล้างข้อมูลเบราว์เซอร์แล้ว
        else console.error("[push] send failed", code, (e as Error).message);
      }
    }),
  );
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
}

/** user id ของพนักงาน (เฉพาะบัญชีที่เปิดใช้งาน) */
export async function userIdsOfEmployees(employeeIds: number[]) {
  if (!employeeIds.length) return new Map<number, number>();
  const rows = await db
    .select({ id: users.id, employeeId: users.employeeId })
    .from(users)
    .where(and(inArray(users.employeeId, employeeIds), eq(users.active, true)));
  return new Map(rows.map((r) => [r.employeeId!, r.id]));
}

/** HR และผู้ดูแลระบบทุกคน (ยกเว้นคนที่ระบุ) */
export async function hrUserIds(exceptUserId?: number) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.active, true), or(eq(users.role, "hr"), eq(users.role, "admin")), exceptUserId ? ne(users.id, exceptUserId) : undefined));
  return rows.map((r) => r.id);
}
