import { and, eq, ne, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { employees, requests } from "@/db/schema";
import type { CurrentUser } from "./auth";

/** ผู้มีสิทธิ์อนุมัติ: HR/admin ทุกคำขอ, หัวหน้า = ลูกทีมโดยตรง — ห้ามอนุมัติของตัวเอง */
export async function canApprove(u: CurrentUser, employeeId: number) {
  if (u.employeeId === employeeId) return false;
  if (u.role === "admin" || u.role === "hr") return true;
  if (u.role !== "manager" || !u.employeeId) return false;
  const [e] = await db.select({ managerId: employees.managerId }).from(employees).where(eq(employees.id, employeeId));
  return e?.managerId === u.employeeId;
}

/** เงื่อนไขคำขอที่ผู้ใช้อนุมัติได้ */
export function approvableWhere(u: { role: string; employeeId: number | null }): SQL | undefined {
  const notSelf = u.employeeId ? ne(requests.employeeId, u.employeeId) : undefined;
  if (u.role === "admin" || u.role === "hr") return notSelf;
  return and(eq(employees.managerId, u.employeeId ?? -1), notSelf);
}
