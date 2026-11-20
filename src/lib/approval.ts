import { and, asc, eq, gte, inArray, isNotNull, lte, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { departments, employeePhotos, employees, leaveTypes, requests, users } from "@/db/schema";
import { isHR, type CurrentUser } from "./auth";
import { bkkDateStr } from "./time";

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

/** ผู้อนุมัติแทนที่ยังมีผลวันนี้: Map<หัวหน้า, ผู้อนุมัติแทน> (หัวหน้าตั้งเองระหว่างลา) */
export async function actingMap(): Promise<Map<number, number>> {
  const rows = await db
    .select({ id: employees.id, acting: employees.actingApproverId })
    .from(employees)
    .where(and(isNotNull(employees.actingApproverId), gte(employees.actingUntil, bkkDateStr())));
  return new Map(rows.map((r) => [r.id, r.acting!]));
}

/** หัวหน้าขั้นที่ 1 + ผู้อนุมัติแทน (ถ้าหัวหน้าตั้งไว้และยังไม่หมดเวลา) */
export async function approversOf(employeeId: number): Promise<{ headId: number | null; actingId: number | null }> {
  const headId = await headOf(employeeId);
  if (!headId) return { headId, actingId: null };
  const acting = (await actingMap()).get(headId) ?? null;
  return { headId, actingId: acting && acting !== employeeId ? acting : null };
}

export function stageOf(r: { status: string; headApprovedAt: Date | null }, headId: number | null): Stage {
  if (r.status !== "pending") return "done";
  return headId && !r.headApprovedAt ? "head" : "hr";
}

/** ผู้ใช้คนนี้ตัดสินคำขอนี้ได้ไหม (ณ ขั้นปัจจุบัน) */
export function canDecide(
  u: Pick<CurrentUser, "role" | "employeeId">,
  r: { employeeId: number; status: string; headApprovedAt: Date | null },
  headId: number | null,
  actingId: number | null = null,
) {
  if (u.employeeId === r.employeeId) return false; // ห้ามอนุมัติของตัวเอง
  const st = stageOf(r, headId);
  // ขั้นหัวหน้า: หัวหน้าเอง หรือผู้อนุมัติแทนระหว่างหัวหน้าลา
  if (st === "head") return !!u.employeeId && (u.employeeId === headId || u.employeeId === actingId);
  if (st === "hr") return u.role === "admin" || u.role === "hr";
  return false;
}

/** คำขอที่รออยู่ทั้งหมด + ขั้นปัจจุบัน + หัวหน้าที่ต้องอนุมัติ (ใช้คัดว่ารอใคร) */
export async function pendingWithStage() {
  const [rows, acting] = await Promise.all([pendingRows(), actingMap()]);
  return rows.map((x) => {
    const headId = headFrom(x.e, x.deptHead);
    const a = headId ? (acting.get(headId) ?? null) : null;
    return { ...x, headId, actingId: a && a !== x.e.id ? a : null, stage: stageOf(x.r, headId) };
  });
}

function pendingRows() {
  return db
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
}

/** คำขอที่รอ "ผู้ใช้คนนี้" ตัดสิน */
export async function pendingForUser(u: CurrentUser) {
  return (await pendingWithStage()).filter((x) => canDecide(u, x.r, x.headId, x.actingId));
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

/**
 * ใบลาของคนแผนกเดียวกันที่วันทับกับใบลาที่รออนุมัติ (อนุมัติแล้ว + รออนุมัติ)
 * ใช้เตือนหัวหน้า/HR ก่อนกดอนุมัติ ว่าวันนั้นแผนกจะขาดคนกี่คน
 */
export async function leaveOverlaps(items: Array<{ id: number; employeeId: number; departmentId: number | null; startDate: string | null; endDate: string | null }>) {
  const leaves = items.filter((x) => x.startDate && x.endDate && x.departmentId);
  const out = new Map<number, Array<{ name: string; startDate: string; endDate: string; status: string }>>();
  if (!leaves.length) return out;
  const min = leaves.reduce((a, x) => (x.startDate! < a ? x.startDate! : a), leaves[0].startDate!);
  const max = leaves.reduce((a, x) => (x.endDate! > a ? x.endDate! : a), leaves[0].endDate!);
  const others = await db
    .select({ id: requests.id, employeeId: requests.employeeId, startDate: requests.startDate, endDate: requests.endDate, status: requests.status, e: employees })
    .from(requests)
    .innerJoin(employees, eq(requests.employeeId, employees.id))
    .where(
      and(
        eq(requests.type, "leave"),
        inArray(requests.status, ["approved", "pending"]),
        lte(requests.startDate, max),
        gte(requests.endDate, min),
        inArray(employees.departmentId, [...new Set(leaves.map((x) => x.departmentId!))]),
      ),
    );
  for (const x of leaves) {
    const hits = others.filter(
      (o) => o.id !== x.id && o.employeeId !== x.employeeId && o.e.departmentId === x.departmentId && o.startDate! <= x.endDate! && o.endDate! >= x.startDate!,
    );
    if (hits.length)
      out.set(
        x.id,
        hits.map((o) => ({ name: `${o.e.firstName} ${o.e.lastName}`, startDate: o.startDate!, endDate: o.endDate!, status: o.status })),
      );
  }
  return out;
}
