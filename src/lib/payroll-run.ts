import Decimal from "decimal.js";
import { and, eq, getTableColumns, gte, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { companySettings, payrollItems, payrollRuns, requests } from "@/db/schema";
import { loadAttendance } from "./attendance-data";
import { calcPay } from "./payroll";
import { eachDate, monthRange } from "./time";

export async function getSettings() {
  const [s] = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  if (s) return s;
  const [created] = await db.insert(companySettings).values({ id: 1 }).returning();
  return created;
}

/** คำนวณเงินเดือนทั้งงวดใหม่ (เก็บค่ารายได้/รายหักอื่นที่ HR กรอกไว้) */
export async function calculateRun(runId: number) {
  const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, runId));
  if (!run) throw new Error("ไม่พบงวดเงินเดือน");
  if (run.status === "finalized") throw new Error("งวดนี้ปิดแล้ว แก้ไขไม่ได้");

  const { start, end, days: daysInMonth } = monthRange(run.year, run.month);
  const [settings, att, ots, existing] = await Promise.all([
    getSettings(),
    loadAttendance({ start, end }),
    db
      .select({ employeeId: requests.employeeId, hours: requests.otHours, rate: requests.otRate })
      .from(requests)
      .where(and(eq(requests.type, "ot"), eq(requests.status, "approved"), gte(requests.otDate, start), lte(requests.otDate, end))),
    db.select().from(payrollItems).where(eq(payrollItems.runId, runId)),
  ]);

  const otBy = new Map<number, { units: Decimal; hours: Decimal }>();
  for (const o of ots) {
    const cur = otBy.get(o.employeeId) ?? { units: new Decimal(0), hours: new Decimal(0) };
    const h = new Decimal(o.hours ?? 0);
    otBy.set(o.employeeId, { units: cur.units.plus(h.mul(o.rate ?? 1.5)), hours: cur.hours.plus(h) });
  }
  const prevBy = new Map(existing.map((i) => [i.employeeId, i]));

  const rows = att.map(({ employee: e, totals: t }) => {
    const from = e.startDate > start ? e.startDate : start;
    const to = e.endDate && e.endDate < end ? e.endDate : end;
    const employedCalendarDays = from <= to ? eachDate(from, to).length : 0;
    const ot = otBy.get(e.id);
    const prev = prevBy.get(e.id);
    const pay = calcPay({
      payType: e.payType,
      baseSalary: e.baseSalary,
      daysInMonth,
      employedCalendarDays,
      workedDays: t.worked,
      paidLeaveDays: t.paidLeave,
      unpaidLeaveDays: t.unpaidLeave,
      absentDays: t.absent,
      paidHolidays: t.paidHolidays,
      lateMinutes: t.lateMinutes,
      otUnits: ot?.units ?? 0,
      allowance: e.monthlyAllowance,
      otherIncome: prev?.otherIncome ?? 0,
      otherDeduction: prev?.otherDeduction ?? 0,
      ssoEnabled: e.ssoEnabled,
      ssoRate: settings.ssoRate,
      ssoMinBase: settings.ssoMinBase,
      ssoMaxBase: settings.ssoMaxBase,
      deductLate: settings.deductLate,
      extraTaxAllowance: e.extraTaxAllowance,
    });
    return {
      runId,
      employeeId: e.id,
      payType: e.payType,
      baseSalary: e.baseSalary,
      scheduledDays: t.scheduled,
      workedDays: t.worked,
      paidLeaveDays: t.paidLeave.toFixed(1),
      unpaidLeaveDays: t.unpaidLeave.toFixed(1),
      absentDays: t.absent,
      lateMinutes: t.lateMinutes,
      otHours: (ot?.hours ?? new Decimal(0)).toFixed(2),
      ...pay,
    };
  });

  const ids = rows.map((r) => r.employeeId);
  await db.delete(payrollItems).where(and(eq(payrollItems.runId, runId), ids.length ? notInArray(payrollItems.employeeId, ids) : undefined));
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await db
      .insert(payrollItems)
      .values(chunk)
      .onConflictDoUpdate({
        target: [payrollItems.runId, payrollItems.employeeId],
        set: Object.fromEntries(
          Object.keys(chunk[0])
            .filter((k) => k !== "runId" && k !== "employeeId")
            .map((k) => [k, sqlExcluded(k)]),
        ),
      });
  }
  await db.update(payrollRuns).set({ calculatedAt: new Date() }).where(eq(payrollRuns.id, runId));
  return rows.length;
}

const itemCols = getTableColumns(payrollItems);
function sqlExcluded(key: string) {
  const col = itemCols[key as keyof typeof itemCols];
  return sql.raw(`excluded."${col.name}"`);
}

/** คำนวณยอดของรายการเดียวใหม่ หลัง HR แก้รายได้อื่น/รายหักอื่น */
export async function recalcItemTotals(itemId: number, otherIncome: string, otherDeduction: string) {
  const [item] = await db.select().from(payrollItems).where(eq(payrollItems.id, itemId));
  if (!item) throw new Error("ไม่พบรายการ");
  await db.update(payrollItems).set({ otherIncome, otherDeduction }).where(eq(payrollItems.id, itemId));
  await calculateRun(item.runId);
}
