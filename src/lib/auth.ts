import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { employeePhotos, employees, users, type Role } from "@/db/schema";
import { readSession } from "./session";

export type CurrentUser = {
  id: number;
  username: string;
  role: Role;
  employeeId: number | null;
  displayName: string;
  nickname: string | null;
  /** เวลาอัปเดตรูปโปรไฟล์ (ms) ใช้เป็น cache-buster · null = ยังไม่มีรูป */
  photoVersion: number | null;
};

/** ดึงผู้ใช้จาก DB ทุก request (role/สถานะล่าสุดเสมอ) — cache() กันยิงซ้ำใน request เดียว */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await readSession();
  if (!s?.uid) return null;
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      active: users.active,
      employeeId: users.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      empStatus: employees.status,
      nickname: employees.nickname,
      photoAt: employeePhotos.updatedAt,
    })
    .from(users)
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .leftJoin(employeePhotos, eq(employeePhotos.employeeId, employees.id))
    .where(eq(users.id, s.uid))
    .limit(1);
  if (!row || !row.active || row.empStatus === "resigned") return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    employeeId: row.employeeId,
    displayName: row.firstName ? `${row.firstName} ${row.lastName}` : row.username,
    nickname: row.nickname,
    photoVersion: row.photoAt ? row.photoAt.getTime() : null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/?error=" + encodeURIComponent("คุณไม่มีสิทธิ์เข้าถึงหน้านี้"));
  return u;
}

export const isHR = (u: CurrentUser) => u.role === "admin" || u.role === "hr";
