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

  const [u] = await db
    .select({ id: users.id, hash: users.passwordHash, active: users.active, empStatus: employees.status })
    .from(users)
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .where(eq(users.username, username))
    .limit(1);
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
