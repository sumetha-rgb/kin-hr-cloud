import { and, asc, eq, inArray, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { departments, employeePhotos, employees, leaveTypes, requests, users } from "@/db/schema";
import { isHR, type CurrentUser } from "./auth";

/**
 * ลำดับการอนุมัติ
 *  - ลา / แก้ไขเวลา : หัวหน้าแผนก (ขั้นที่ 1) → HR (ขั้นสุดท้าย)
 *  - OT             : หัวหน้าแผนกอนุมัติจบในขั้นเดียว แล้วแจ้ง HR ให้ทราบ
 *  - ไม่มีหัวหน้า (แผนกยังไม่ตั้ง / ผู้ยื่นเป็นหัวหน้าเอง) → ส่งตรงถึง HR
 *  - HR ข้ามขั้นหัวหน้าไม่ได้ (เว้นแต่ HR เป็นหัวหน้าของคนนั้นเอง)
 * หัวหน้า = "หัวหน้างาน" ที่ตั้งรายคน (ถ้ามี) มิฉะนั้นใช้หัวหน้าแผนก
 */
export type Stage = "head" | "hr" | "done";
export const HEAD_IS_FINAL = new Set(["ot"]);

type EmpLite = {
  id: number;
  managerId: number | null;
  departmentId: number | null;
};

/** หัวหน้าขั้นที่ 1 จากข้อมูลที่ join มาแล้ว (ไม่ใช่ตัวผู้ยื่นเอง) */
export function headFrom(emp: EmpLite, deptHead: number | null | undefined): number | null {
  if (emp.managerId && emp.managerId !== emp.id) return emp.managerId;
  if (deptHead && deptHead !== emp.id) return deptHead;
  return null;
}

/** หัวหน้าขั้นที่ 1 ของพนักงานคนนี้ (อ่านจากฐานข้อมูล) */
export async function headOf(employeeId: number): Promise<number | null> {
  const [row] = await db
    .select({
      id: employees.id,
      managerId: employees.managerId,
      departmentId: employees.departmentId,
      deptHead: departments.headEmployeeId,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(employees.id, employeeId));
  return row ? headFrom(row, row.deptHead) : null;
}

export function stageOf(r: { status: string; headApprovedAt: Date | null }, headId: number | null): Stage {
  if (r.status !== "pending") return "done";
  return headId && !r.headApprovedAt ? "head" : "hr";
}

/** ผู้ใช้คนนี้ตัดสินคำขอนี้ได้ไหม (ณ ขั้นปัจจุบัน) */
export function canDecide(u: Pick<CurrentUser, "role" | "employeeId">, r: { employeeId: number; status: string; headApprovedAt: Date | null }, headId: number | null) {
  if (u.employeeId === r.employeeId) return false; // ห้ามอนุมัติของตัวเอง
  const st = stageOf(r, headId);
  if (st === "head") return !!u.employeeId && u.employeeId === headId;
  if (st === "hr") return u.role === "admin" || u.role === "hr";
  return false;
}

/** คำขอที่รออยู่ทั้งหมด + ขั้นปัจจุบัน + หัวหน้าที่ต้องอนุมัติ (ใช้คัดว่ารอใคร) */
export async function pendingWithStage() {
  const rows = await db
    .select({
      r: requests,
      e: employees,
      leaveName: leaveTypes.name,
      deptHead: departments.headEmployeeId,
      photoAt: employeePhotos.updatedAt,
    })
    .from(requests)
    .innerJoin(employees, eq(requests.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(employeePhotos, eq(employeePhotos.employeeId, employees.id))
    .leftJoin(leaveTypes, eq(requests.leaveTypeId, leaveTypes.id))
    .where(eq(requests.status, "pending"))
    .orderBy(asc(requests.createdAt));
  return rows.map((x) => {
    const headId = headFrom(x.e, x.deptHead);
    return { ...x, headId, stage: stageOf(x.r, headId) };
  });
}

/** คำขอที่รอ "ผู้ใช้คนนี้" ตัดสิน */
export async function pendingForUser(u: CurrentUser) {
  return (await pendingWithStage()).filter((x) => canDecide(u, x.r, x.headId));
}

/** ประวัติคำขอที่ผู้ใช้เกี่ยวข้อง: HR = ทั้งหมด · หัวหน้า = ที่ตัวเองอนุมัติ/ไม่อนุมัติ (ขั้นใดก็ได้) */
export function historyWhere(u: CurrentUser): SQL | undefined {
  const notSelf = u.employeeId ? ne(requests.employeeId, u.employeeId) : undefined;
  if (isHR(u)) return notSelf;
  return and(or(eq(requests.decidedBy, u.id), eq(requests.headApprovedBy, u.id)), notSelf);
}

/** ชื่อสั้น (ชื่อ นามสกุล) ของพนักงาน/ผู้ใช้ — ใช้แสดงว่าใครอนุมัติหรือรอใคร */
export async function namesOf(ids: { users?: (number | null)[]; employees?: (number | null)[] }) {
  const uIds = [...new Set((ids.users ?? []).filter((x): x is number => !!x))];
  const eIds = [...new Set((ids.employees ?? []).filter((x): x is number => !!x))];
  const [us, es] = await Promise.all([
    uIds.length
      ? db
          .select({
            id: users.id,
            username: users.username,
            firstName: employees.firstName,
            lastName: employees.lastName,
          })
          .from(users)
          .leftJoin(employees, eq(users.employeeId, employees.id))
          .where(inArray(users.id, uIds))
      : [],
    eIds.length
      ? db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          })
          .from(employees)
          .where(inArray(employees.id, eIds))
      : [],
  ]);
  return {
    user: new Map(us.map((x) => [x.id, x.firstName ? `${x.firstName} ${x.lastName}` : x.username])),
    employee: new Map(es.map((x) => [x.id, `${x.firstName} ${x.lastName}`])),
  };
}

/** พนักงานที่ผู้ใช้เป็นหัวหน้า (รายคน + ทั้งแผนกที่เป็นหัวหน้าแผนก) */
export async function teamOf(employeeId: number): Promise<number[]> {
  const depts = (await db.select({ id: departments.id }).from(departments).where(eq(departments.headEmployeeId, employeeId))).map((d) => d.id);
  const rows = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(ne(employees.id, employeeId), or(eq(employees.managerId, employeeId), depts.length ? inArray(employees.departmentId, depts) : undefined)));
  return rows.map((r) => r.id);
}
