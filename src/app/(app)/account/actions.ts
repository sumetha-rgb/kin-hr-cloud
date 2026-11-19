"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
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
