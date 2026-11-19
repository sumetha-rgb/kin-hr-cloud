"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employees, users } from "@/db/schema";
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
  // เทียบ hash เสมอแม้ไม่พบผู้ใช้ เพื่อไม่ให้เดาชื่อผู้ใช้จากเวลาตอบกลับ
  const ok = await bcrypt.compare(password, u?.hash ?? (dummyHash ??= await bcrypt.hash("dummy-password", 12)));
  if (!u || !ok) return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  if (!u.active || u.empStatus === "resigned") return { error: "บัญชีนี้ถูกระงับการใช้งาน" };

  await createSession(u.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
