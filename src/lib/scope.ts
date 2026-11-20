import { teamOf } from "./approval";
import type { CurrentUser } from "./auth";

/** รายชื่อพนักงานที่ผู้ใช้มีสิทธิ์ดู: HR/admin = ทั้งหมด (undefined), หัวหน้า = ลูกทีม (รายคน + ทั้งแผนกที่เป็นหัวหน้า) + ตัวเอง, พนักงาน = ตัวเอง */
export async function visibleEmployeeIds(u: CurrentUser): Promise<number[] | undefined> {
  if (u.role === "admin" || u.role === "hr") return undefined;
  const self = u.employeeId ? [u.employeeId] : [];
  if (u.role !== "manager" || !u.employeeId) return self;
  return [...self, ...(await teamOf(u.employeeId))];
}

export async function canSeeEmployee(u: CurrentUser, employeeId: number) {
  const ids = await visibleEmployeeIds(u);
  return ids === undefined || ids.includes(employeeId);
}
