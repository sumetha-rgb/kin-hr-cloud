"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { companySettings, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { parseForm, zBool } from "@/lib/form";
import { getSettings } from "@/lib/payroll-run";
import { withMsg } from "@/lib/util";

const back = (fd: FormData, fallback: string) => {
  const b = String(fd.get("back") ?? "");
  return b.startsWith("/admin") ? b : fallback;
};

export async function saveSystemSettings(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const P = "/admin/settings";
  const r = parseForm(
    z.object({
      demoLogin: zBool,
      selfProfileEdit: zBool,
      announcement: z.string().max(500, "ประกาศยาวได้ไม่เกิน 500 ตัวอักษร").optional(),
    }),
    fd,
  );
  if (!r.ok) redirect(withMsg(P, { error: r.error }));
  await getSettings(); // ให้มีแถว id=1 ก่อน
  const values = { ...r.data, announcement: r.data.announcement ?? null, updatedAt: new Date() };
  await db.update(companySettings).set(values).where(eq(companySettings.id, 1));
  await audit(u.id, "update_system", "system", 1, r.data);
  revalidatePath("/", "layout");
  redirect(withMsg(P, { ok: "บันทึกการตั้งค่าระบบแล้ว" }));
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
