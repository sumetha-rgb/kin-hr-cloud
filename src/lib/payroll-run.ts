import Decimal from "decimal.js";
import { and, eq, getTableColumns, gte, lt, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { companySettings, payrollItems, payrollRuns, requests, taxOpeningBalances } from "@/db/schema";
import { loadAttendance } from "./attendance-data";
import { calcPay, type Ytd } from "./payroll";
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
  const [settings, att, ots, existing, ytdRows, openings] = await Promise.all([
    getSettings(),
    loadAttendance({ start, end }),
    db
      .select({ employeeId: requests.employeeId, hours: requests.otHours, rate: requests.otRate })
      .from(requests)
      .where(and(eq(requests.type, "ot"), eq(requests.status, "approved"), gte(requests.otDate, start), lte(requests.otDate, end))),
    db.select().from(payrollItems).where(eq(payrollItems.runId, runId)),
    // ยอดสะสมต้นปีจากงวดที่ปิดแล้ว (ใช้หักภาษีแบบสะสม)
    db
      .select({
        employeeId: payrollItems.employeeId,
        taxable: sql<string>`coalesce(sum(greatest(${payrollItems.gross} - ${payrollItems.lateDeduction}, 0)), 0)`,
        sso: sql<string>`coalesce(sum(${payrollItems.sso}), 0)`,
        tax: sql<string>`coalesce(sum(${payrollItems.tax}), 0)`,
        months: sql<number>`count(*)::int`,
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.runId, payrollRuns.id))
      .where(and(eq(payrollRuns.year, run.year), lt(payrollRuns.month, run.month), eq(payrollRuns.status, "finalized")))
      .groupBy(payrollItems.employeeId),
    db.select().from(taxOpeningBalances).where(eq(taxOpeningBalances.year, run.year)),
  ]);
  const ytdBy = new Map(ytdRows.map((y) => [y.employeeId, y]));
  const openingBy = new Map(openings.map((o) => [o.employeeId, o]));

  /**
   * ยอดสะสมสำหรับหักภาษีแบบสะสม — ใช้ได้เมื่อรู้เงินได้ครบทุกเดือนก่อนหน้าของปี
   * (มีงวดในระบบครบ หรือ HR กรอกยอดยกมาไว้) ไม่ครบ → คืน null ให้ใช้วิธีประมาณ × 12 แบบเดิม
   */
  const ytdFor = (e: { id: number; startDate: string }): Ytd | null => {
    const y = ytdBy.get(e.id);
    const o = openingBy.get(e.id);
    const startMonth = Number(e.startDate.slice(0, 4)) < run.year ? 1 : Number(e.startDate.slice(5, 7));
    const priorMonths = Math.max(0, run.month - startMonth);
    if (!o && (y?.months ?? 0) < priorMonths) return null;
    return {
      taxable: new Decimal(y?.taxable ?? 0).plus(o?.income ?? 0),
      sso: new Decimal(y?.sso ?? 0).plus(o?.sso ?? 0),
      tax: new Decimal(y?.tax ?? 0).plus(o?.tax ?? 0),
    };
  };

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
      extraTaxAllowance: e.extraTaxAllowance,
      ...((ytd) => (ytd ? { month: run.month, ytd } : {}))(ytdFor(e)),
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

/** สรุปเงินได้/ภาษี/ประกันสังคมทั้งปีต่อคน (งวดที่ปิดแล้ว + ยอดยกมา) — ใช้กับหน้าภาษีทั้งปีและ 50 ทวิ */
export async function annualTaxSummary(year: number, employeeId?: number) {
  const [rows, openings] = await Promise.all([
    db
      .select({
        employeeId: payrollItems.employeeId,
        income: sql<string>`coalesce(sum(greatest(${payrollItems.gross} - ${payrollItems.lateDeduction}, 0)), 0)`,
        sso: sql<string>`coalesce(sum(${payrollItems.sso}), 0)`,
        tax: sql<string>`coalesce(sum(${payrollItems.tax}), 0)`,
        months: sql<number>`count(*)::int`,
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.runId, payrollRuns.id))
      .where(and(eq(payrollRuns.year, year), eq(payrollRuns.status, "finalized"), employeeId ? eq(payrollItems.employeeId, employeeId) : undefined))
      .groupBy(payrollItems.employeeId),
    db
      .select()
      .from(taxOpeningBalances)
      .where(and(eq(taxOpeningBalances.year, year), employeeId ? eq(taxOpeningBalances.employeeId, employeeId) : undefined)),
  ]);
  const out = new Map<
    number,
    {
      inSystem: { income: Decimal; sso: Decimal; tax: Decimal; months: number };
      opening: (typeof openings)[number] | null;
      total: { income: Decimal; sso: Decimal; tax: Decimal };
    }
  >();
  const ensure = (id: number) => {
    if (!out.has(id))
      out.set(id, {
        inSystem: { income: new Decimal(0), sso: new Decimal(0), tax: new Decimal(0), months: 0 },
        opening: null,
        total: { income: new Decimal(0), sso: new Decimal(0), tax: new Decimal(0) },
      });
    return out.get(id)!;
  };
  for (const r of rows) ensure(r.employeeId).inSystem = { income: new Decimal(r.income), sso: new Decimal(r.sso), tax: new Decimal(r.tax), months: r.months };
  for (const o of openings) ensure(o.employeeId).opening = o;
  for (const v of out.values()) {
    const o = v.opening;
    v.total = {
      income: v.inSystem.income.plus(o?.income ?? 0),
      sso: v.inSystem.sso.plus(o?.sso ?? 0),
      tax: v.inSystem.tax.plus(o?.tax ?? 0),
    };
  }
  return out;
}
