"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { employeePhotos, employees, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { isHR, requireUser } from "@/lib/auth";
import { parseForm } from "@/lib/form";
import { withMsg } from "@/lib/util";

export async function changePassword(fd: FormData) {
  const u = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const P = "/account";
  if (next.length < 8) redirect(withMsg(P, { error: "รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร" }));
  if (next !== confirm) redirect(withMsg(P, { error: "ยืนยันรหัสผ่านไม่ตรงกัน" }));
  const [row] = await db.select().from(users).where(eq(users.id, u.id));
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) redirect(withMsg(P, { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }));
  await db.update(users).set({ passwordHash: await bcrypt.hash(next, 12) }).where(eq(users.id, u.id));
  await audit(u.id, "change_password", "user", u.id);
  redirect(withMsg(P, { ok: "เปลี่ยนรหัสผ่านแล้ว" }));
}

/** ข้อมูลที่พนักงานแก้เองได้ (ชื่อจริง ตำแหน่ง เงินเดือน ฯลฯ ให้ HR แก้) */
const profileSchema = z.object({
  nickname: z.string().max(40).optional(),
  phone: z.string().max(30).optional(),
  email: z.email("อีเมลไม่ถูกต้อง").optional(),
  lineId: z.string().max(60).optional(),
  address: z.string().max(500).optional(),
  emergencyName: z.string().max(100).optional(),
  emergencyPhone: z.string().max(30).optional(),
  bio: z.string().max(300, "แนะนำตัวได้ไม่เกิน 300 ตัวอักษร").optional(),
});

export async function saveMyProfile(fd: FormData) {
  const u = await requireUser();
  const P = "/account";
  if (!u.employeeId) redirect(withMsg(P, { error: "บัญชีนี้ไม่ได้ผูกกับพนักงาน" }));
  const r = parseForm(profileSchema, fd);
  if (!r.ok) redirect(withMsg(P, { error: r.error }));
  const values = Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, v ?? null]));
  await db.update(employees).set(values).where(eq(employees.id, u.employeeId));
  await audit(u.id, "update_profile", "employee", u.employeeId);
  redirect(withMsg(P, { ok: "บันทึกโปรไฟล์แล้ว" }));
}

const MAX_PHOTO_BYTES = 400_000;

/** อัปโหลด/ลบรูปโปรไฟล์ — ตัวเองหรือ HR เท่านั้น (รูปย่อขนาดที่เบราว์เซอร์ก่อนส่ง) */
export async function savePhoto(fd: FormData) {
  const u = await requireUser();
  const empId = Number(fd.get("employeeId"));
  const back = String(fd.get("back") ?? "/account");
  const P = back.startsWith("/") ? back : "/account";
  if (!empId || (empId !== u.employeeId && !isHR(u))) redirect(withMsg(P, { error: "ไม่มีสิทธิ์แก้รูปของพนักงานคนนี้" }));

  if (fd.get("remove") === "1") {
    await db.delete(employeePhotos).where(eq(employeePhotos.employeeId, empId));
    await audit(u.id, "remove_photo", "employee", empId);
  } else {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(fd.get("photo") ?? ""));
    if (!m) redirect(withMsg(P, { error: "ไฟล์รูปไม่ถูกต้อง" }));
    const [, mime, data] = m;
    if ((data.length * 3) / 4 > MAX_PHOTO_BYTES) redirect(withMsg(P, { error: "รูปใหญ่เกินไป" }));
    const now = new Date();
    await db
      .insert(employeePhotos)
      .values({ employeeId: empId, mime, data, updatedAt: now })
      .onConflictDoUpdate({ target: employeePhotos.employeeId, set: { mime, data, updatedAt: now } });
    await audit(u.id, "update_photo", "employee", empId);
  }
  revalidatePath("/", "layout");
  redirect(withMsg(P, { ok: fd.get("remove") === "1" ? "ลบรูปโปรไฟล์แล้ว" : "อัปเดตรูปโปรไฟล์แล้ว" }));
}
