"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employees, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { failedAttempts, LOCK_MAX, LOCK_MIN } from "@/lib/lockout";
import { createSession, destroySession } from "@/lib/session";

let dummyHash: string | null = null;

export async function login(_prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "/");
  if (!username || !password) return { error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };

  // ตรวจการตั้งค่าเซิร์ฟเวอร์ก่อน เพื่อให้รู้สาเหตุแทนหน้า error เปล่า ๆ
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
    console.error("[login] AUTH_SECRET is missing or too short");
    return { error: "ระบบยังไม่ได้ตั้งค่า AUTH_SECRET บนเซิร์ฟเวอร์ — แจ้งผู้ดูแลระบบให้เพิ่มใน Vercel แล้ว Redeploy" };
  }

  let u: { id: number; hash: string; active: boolean; empStatus: string | null } | undefined;
  try {
    [u] = await db
      .select({ id: users.id, hash: users.passwordHash, active: users.active, empStatus: employees.status })
      .from(users)
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .where(eq(users.username, username))
      .limit(1);
  } catch (e) {
    console.error("[login] database error", e);
    const msg = String((e as Error)?.message ?? e);
    const hint = /does not exist/.test(msg)
      ? "ฐานข้อมูลยังไม่มีตาราง (ยังไม่ได้ migrate)"
      : /password authentication|authentication failed/i.test(msg)
        ? "รหัสผ่านฐานข้อมูลใน DATABASE_URL ไม่ถูกต้อง"
        : "เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจค่า DATABASE_URL";
    return { error: `${hint} — แจ้งผู้ดูแลระบบ` };
  }
  // กันเดารหัสผ่าน: ผิดครบ LOCK_MAX ครั้งใน LOCK_MIN นาที → ล็อกชื่อผู้ใช้นี้ชั่วคราว (HR ปลดล็อกได้ที่ ดูแลระบบ → บัญชีผู้ใช้)
  const fails = await failedAttempts(username);
  if (fails >= LOCK_MAX) {
    await audit(u?.id ?? null, "login_locked", "user", username);
    return { error: `ใส่รหัสผ่านผิดเกิน ${LOCK_MAX} ครั้ง บัญชีนี้ถูกล็อกชั่วคราว ${LOCK_MIN} นาที — ลองใหม่ภายหลังหรือติดต่อฝ่ายบุคคล` };
  }

  // เทียบ hash เสมอแม้ไม่พบผู้ใช้ เพื่อไม่ให้เดาชื่อผู้ใช้จากเวลาตอบกลับ
  const ok = await bcrypt.compare(password, u?.hash ?? (dummyHash ??= await bcrypt.hash("dummy-password", 12)));
  if (!u || !ok) {
    await audit(u?.id ?? null, "login_failed", "user", username);
    const left = LOCK_MAX - fails - 1;
    if (left <= 0) return { error: `ใส่รหัสผ่านผิดครบ ${LOCK_MAX} ครั้ง บัญชีนี้ถูกล็อกชั่วคราว ${LOCK_MIN} นาที — ลองใหม่ภายหลังหรือติดต่อฝ่ายบุคคล` };
    return { error: left <= 2 ? `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เหลืออีก ${left} ครั้งก่อนถูกล็อกชั่วคราว)` : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }
  if (!u.active || u.empStatus === "resigned") return { error: "บัญชีนี้ถูกระงับการใช้งาน" };

  await createSession(u.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await audit(u.id, "login", "user", username);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
