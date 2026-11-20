"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { companySettings, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { parseForm } from "@/lib/form";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/payroll-run";
import { withMsg } from "@/lib/util";

const back = (fd: FormData, fallback: string) => {
  const b = String(fd.get("back") ?? "");
  return b.startsWith("/admin") ? b : fallback;
};

/**
 * ประกาศถึงพนักงาน: ขึ้นแถบประกาศที่หน้าหลักทุกคน + ส่งแจ้งเตือน (ในระบบและเด้งบนมือถือ) ถึงทุกบัญชีที่ใช้งานอยู่
 */
export async function publishAnnouncement(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const P = "/admin/settings";
  const r = parseForm(z.object({ announcement: z.string().min(1, "พิมพ์ข้อความประกาศก่อน").max(500, "ประกาศยาวได้ไม่เกิน 500 ตัวอักษร") }), fd);
  if (!r.ok) redirect(withMsg(P, { error: r.error }));
  const text = r.data.announcement;
  await getSettings(); // ให้มีแถว id=1 ก่อน
  await db.update(companySettings).set({ announcement: text, updatedAt: new Date() }).where(eq(companySettings.id, 1));
  const everyone = (await db.select({ id: users.id }).from(users).where(eq(users.active, true))).map((x) => x.id);
  await notify(everyone, { kind: "system", title: "ประกาศจากฝ่ายบุคคล", body: text.length > 140 ? text.slice(0, 137) + "..." : text, href: "/" });
  await audit(u.id, "announce", "system", 1, { announcement: text, recipients: everyone.length });
  revalidatePath("/", "layout");
  redirect(withMsg(P, { ok: `ประกาศแล้ว ส่งแจ้งเตือนถึง ${everyone.length} คน` }));
}

/** เอาประกาศออกจากหน้าหลัก (ไม่ลบแจ้งเตือนที่ส่งไปแล้ว) */
export async function clearAnnouncement() {
  const u = await requireRole("admin", "hr");
  await db.update(companySettings).set({ announcement: null, updatedAt: new Date() }).where(eq(companySettings.id, 1));
  await audit(u.id, "update_system", "system", 1, { announcement: null });
  revalidatePath("/", "layout");
  redirect(withMsg("/admin/settings", { ok: "เอาประกาศออกจากหน้าหลักแล้ว" }));
}

/** เปิด/ระงับบัญชี — ระงับแล้วออกจากระบบทันที (getCurrentUser ตรวจ active ทุก request) */
export async function setUserActive(fd: FormData) {
  const me = await requireRole("admin", "hr");
  const id = Number(fd.get("userId"));
  const active = fd.get("active") === "1";
  const P = back(fd, "/admin/users");
  if (id === me.id) redirect(withMsg(P, { error: "ระงับบัญชีของตัวเองไม่ได้" }));
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) redirect(withMsg(P, { error: "ไม่พบบัญชี" }));
  if (target.role === "admin" && me.role !== "admin") redirect(withMsg(P, { error: "แก้ไขบัญชีผู้ดูแลระบบไม่ได้" }));
  await db.update(users).set({ active }).where(eq(users.id, id));
  await audit(me.id, active ? "enable_user" : "disable_user", "user", target.username);
  redirect(withMsg(P, { ok: `${active ? "เปิดใช้งาน" : "ระงับ"}บัญชี ${target.username} แล้ว` }));
}

/** ปลดล็อกบัญชีที่ใส่รหัสผิดเกินกำหนด (บันทึกเป็นประวัติ ไม่ลบประวัติเดิม) */
export async function unlockUser(fd: FormData) {
  const me = await requireRole("admin", "hr");
  const username = String(fd.get("username") ?? "");
  const P = back(fd, "/admin/users");
  if (!username) redirect(withMsg(P, { error: "ไม่พบบัญชี" }));
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  await audit(me.id, "unlock", "user", username, { userId: target?.id ?? null });
  redirect(withMsg(P, { ok: `ปลดล็อก ${username} แล้ว` }));
}
