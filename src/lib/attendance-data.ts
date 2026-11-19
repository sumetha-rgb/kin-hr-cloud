import { and, eq, gte, inArray, lte, ne, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attendanceLogs, employees, holidays, leaveTypes, requests, shifts, type Employee, type Shift } from "@/db/schema";
import { summarizeDays, totals, type DayRecord, type LeaveSpan, type Punch } from "./attendance";
import { addDays, atBkk } from "./time";

export type EmployeeAttendance = {
  employee: Employee;
  shift: Shift | null;
  days: DayRecord[];
  totals: ReturnType<typeof totals>;
};

/** โหลดและสรุปเวลาทำงานของพนักงาน (ทั้งหมด หรือเฉพาะ id ที่ระบุ) ในช่วงวันที่ */
export async function loadAttendance(opts: { start: string; end: string; employeeIds?: number[]; includeResigned?: boolean }) {
  const { start, end, employeeIds } = opts;
  if (employeeIds && employeeIds.length === 0) return [];
  const empFilter = employeeIds ? inArray(employees.id, employeeIds) : undefined;
  const activeFilter = opts.includeResigned ? undefined : or(ne(employees.status, "resigned"), gte(employees.endDate, start));

  const [emps, hol, lv, logs] = await Promise.all([
    db
      .select({ e: employees, shift: shifts })
      .from(employees)
      .leftJoin(shifts, eq(employees.shiftId, shifts.id))
      .where(and(empFilter, activeFilter, lte(employees.startDate, end), or(isNull(employees.endDate), gte(employees.endDate, start))))
      .orderBy(employees.code),
    db.select().from(holidays).where(and(gte(holidays.date, start), lte(holidays.date, end))),
    db
      .select({
        employeeId: requests.employeeId,
        startDate: requests.startDate,
        endDate: requests.endDate,
        days: requests.days,
        paid: leaveTypes.paid,
        name: leaveTypes.name,
      })
      .from(requests)
      .innerJoin(leaveTypes, eq(requests.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(requests.type, "leave"),
          eq(requests.status, "approved"),
          lte(requests.startDate, end),
          gte(requests.endDate, start),
          employeeIds ? inArray(requests.employeeId, employeeIds) : undefined,
        ),
      ),
    db
      .select({ employeeId: attendanceLogs.employeeId, type: attendanceLogs.type, punchedAt: attendanceLogs.punchedAt })
      .from(attendanceLogs)
      .where(
        and(
          gte(attendanceLogs.punchedAt, atBkk(addDays(start, -1))),
          lte(attendanceLogs.punchedAt, atBkk(addDays(end, 2))),
          employeeIds ? inArray(attendanceLogs.employeeId, employeeIds) : undefined,
        ),
      ),
  ]);

  const holidayMap = new Map(hol.map((h) => [h.date, h.name]));
  const leavesBy = new Map<number, LeaveSpan[]>();
  for (const l of lv) {
    if (!l.startDate || !l.endDate) continue;
    const arr = leavesBy.get(l.employeeId) ?? [];
    arr.push({ startDate: l.startDate, endDate: l.endDate, days: Number(l.days ?? 1), paid: l.paid, name: l.name });
    leavesBy.set(l.employeeId, arr);
  }
  const punchesBy = new Map<number, Punch[]>();
  for (const p of logs) {
    const arr = punchesBy.get(p.employeeId) ?? [];
    arr.push({ type: p.type, punchedAt: p.punchedAt });
    punchesBy.set(p.employeeId, arr);
  }

  return emps.map(({ e, shift }): EmployeeAttendance => {
    const days = summarizeDays({
      start,
      end,
      shift,
      punches: punchesBy.get(e.id) ?? [],
      holidays: holidayMap,
      leaves: leavesBy.get(e.id) ?? [],
      employedFrom: e.startDate,
      employedTo: e.endDate,
    });
    return { employee: e, shift, days, totals: totals(days) };
  });
}
