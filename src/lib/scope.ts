import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";
import type { CurrentUser } from "./auth";

/** รายชื่อพนักงานที่ผู้ใช้มีสิทธิ์ดู: HR/admin = ทั้งหมด (undefined), หัวหน้า = ลูกทีมโดยตรง + ตัวเอง, พนักงาน = ตัวเอง */
export async function visibleEmployeeIds(u: CurrentUser): Promise<number[] | undefined> {
  if (u.role === "admin" || u.role === "hr") return undefined;
  const self = u.employeeId ? [u.employeeId] : [];
  if (u.role !== "manager" || !u.employeeId) return self;
  const team = await db.select({ id: employees.id }).from(employees).where(eq(employees.managerId, u.employeeId));
  return [...self, ...team.map((t) => t.id)];
}

export async function canSeeEmployee(u: CurrentUser, employeeId: number) {
  const ids = await visibleEmployeeIds(u);
  return ids === undefined || ids.includes(employeeId);
}
