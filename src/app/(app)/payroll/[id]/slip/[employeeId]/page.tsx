/* eslint-disable @next/next/no-img-element */
import { and, eq, lt, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Decimal from "decimal.js";
import { db } from "@/db";
import { branches, departments, employees, payrollItems, payrollRuns, positions, taxOpeningBalances } from "@/db/schema";
import { Icon, type IconName } from "@/components/icons";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/payroll-run";
import { fmtDate, fmtMonth } from "@/lib/time";
import { cn, fmtMoney, fullName } from "@/lib/util";

export const metadata = { title: "สลิปเงินเดือน" };

/** แสดงเลขบัญชีแค่ 4 ตัวท้าย (สลิปอาจถูกส่งต่อ/พิมพ์ทิ้งไว้) */
function maskAccount(acc: string | null) {
  const d = (acc ?? "").replace(/\D/g, "");
  return d.length >= 4 ? `•••• ${d.slice(-4)}` : acc || "-";
}

function Lines({
  title,
  icon,
  tone,
  rows,
  total,
  totalLabel,
}: {
  title: string;
  icon: IconName;
  tone: "in" | "out";
  rows: Array<[string, string | Decimal]>;
  total: string | Decimal;
  totalLabel: string;
}) {
  const shown = rows.filter(([, v], i) => i === 0 || !new Decimal(v).isZero()); // บรรทัดแรกแสดงเสมอ ที่เหลือซ่อนถ้าเป็น 0
  return (
    <section className="rounded-2xl border border-brand-100 p-4 print:break-inside-avoid">
      <h3 className={cn("mb-3 flex items-center gap-2 text-sm font-semibold", tone === "in" ? "text-emerald-700" : "text-rose-700")}>
        <span className={cn("flex size-7 items-center justify-center rounded-lg", tone === "in" ? "bg-emerald-50" : "bg-rose-50")}>
          <Icon name={icon} className="size-4" />
        </span>
        {title}
      </h3>
      <dl className="space-y-2 text-[15px] sm:text-sm">
        {shown.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-stone-600">{k}</dt>
            <dd className="font-medium text-brand-900 tabular-nums">{fmtMoney(v as string)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-brand-200 pt-3 text-[15px] font-semibold sm:text-sm">
        <span className="text-brand-900">{totalLabel}</span>
        <span className={cn("tabular-nums", tone === "in" ? "text-emerald-700" : "text-rose-700")}>
          {tone === "out" && !new Decimal(total).isZero() ? "−" : ""}
          {fmtMoney(total as string)}
        </span>
      </div>
    </section>
  );
}

export default async function SlipPage({ params }: { params: Promise<{ id: string; employeeId: string }> }) {
  const u = await requireUser();
  const { id, employeeId } = await params;
  const hr = u.role === "admin" || u.role === "hr";
  if (!hr && u.employeeId !== Number(employeeId)) redirect("/payroll/my");

  const [row] = await db
    .select({ i: payrollItems, run: payrollRuns, e: employees, branch: branches.name, dept: departments.name, pos: positions.name })
    .from(payrollItems)
    .innerJoin(payrollRuns, eq(payrollItems.runId, payrollRuns.id))
    .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .where(and(eq(payrollItems.runId, Number(id)), eq(payrollItems.employeeId, Number(employeeId))));
  if (!row || (!hr && row.run.status !== "finalized")) notFound();
  const { i, run, e } = row;
  // ยอดสะสมตั้งแต่ต้นปีถึงงวดนี้ = งวดก่อนหน้าที่ปิดแล้ว + ยอดยกมา + งวดนี้
  const [company, [prev], [opening]] = await Promise.all([
    getSettings(),
    db
      .select({
        income: sql<string>`coalesce(sum(greatest(${payrollItems.gross} - ${payrollItems.lateDeduction}, 0)), 0)`,
        sso: sql<string>`coalesce(sum(${payrollItems.sso}), 0)`,
        tax: sql<string>`coalesce(sum(${payrollItems.tax}), 0)`,
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.runId, payrollRuns.id))
      .where(and(eq(payrollItems.employeeId, i.employeeId), eq(payrollRuns.year, run.year), lt(payrollRuns.month, run.month), eq(payrollRuns.status, "finalized"))),
    db
      .select()
      .from(taxOpeningBalances)
      .where(and(eq(taxOpeningBalances.employeeId, i.employeeId), eq(taxOpeningBalances.year, run.year))),
  ]);
  const ytd = {
    income: Number(prev?.income ?? 0) + Number(opening?.income ?? 0) + Math.max(Number(i.gross) - Number(i.lateDeduction), 0),
    sso: Number(prev?.sso ?? 0) + Number(opening?.sso ?? 0) + Number(i.sso),
    tax: Number(prev?.tax ?? 0) + Number(opening?.tax ?? 0) + Number(i.tax),
  };
  const final = run.status === "finalized";

  const incomes: Array<[string, string]> = [
    [i.payType === "monthly" ? "เงินเดือน" : `ค่าจ้างรายวัน (${i.workedDays} วัน)`, i.earnedSalary],
    [`ค่าล่วงเวลา (OT ${Number(i.otHours)} ชม.)`, i.otAmount],
    ["เงินเพิ่มประจำ", i.allowance],
    ["รายได้อื่น", i.otherIncome],
  ];
  const deductions: Array<[string, string]> = [
    ["ประกันสังคม", i.sso],
    ["ภาษีหัก ณ ที่จ่าย", i.tax],
    // มาสายไม่หักเงิน — แสดงเฉพาะสลิปเก่าที่เคยหักไว้
    ...(Number(i.lateDeduction) > 0 ? [[`หักมาสาย (${i.lateMinutes} นาที)`, i.lateDeduction] as [string, string]] : []),
    ["รายหักอื่น", i.otherDeduction],
  ];
  const totalDeduct = deductions.reduce((a, [, v]) => a.plus(v), new Decimal(0));
  const leave = Number(i.paidLeaveDays) + Number(i.unpaidLeaveDays);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={hr ? `/payroll/${run.id}` : "/payroll/my"} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
          <Icon name="chevronLeft" className="size-4" />
          {hr ? "กลับไปงวดเงินเดือน" : "สลิปทั้งหมด"}
        </Link>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-3xl border border-brand-200/80 bg-white shadow-card print:rounded-none print:border-0 print:shadow-none">
        {/* หัวเอกสาร */}
        <header className="flex flex-col gap-4 border-b border-brand-100 bg-gradient-to-b from-brand-50/70 to-white px-6 pt-6 pb-5 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-brand-200">
              <img src="/kin-logo.png" alt="" width={40} height={40} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-brand-900">{company.name}</p>
              {company.address && <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{company.address}</p>}
              {company.taxId && <p className="text-xs text-stone-500">เลขประจำตัวผู้เสียภาษี {company.taxId}</p>}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-xs font-medium tracking-[0.18em] text-brand-500">PAYSLIP</p>
            <p className="text-lg font-semibold text-brand-900">ใบแจ้งเงินเดือน</p>
            <p className="text-sm text-brand-700">งวด {fmtMonth(run.year, run.month)}</p>
            <span
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                final ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
              )}
            >
              <Icon name={final ? "checkCircle" : "info"} className="size-3.5" />
              {final ? `ออกเมื่อ ${fmtDate(run.finalizedAt)}` : "ฉบับร่าง — ยังไม่ปิดงวด"}
            </span>
          </div>
        </header>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          {/* ยอดสุทธิ */}
          <section className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white sm:flex-row sm:items-end sm:justify-between print:bg-none print:text-brand-900 print:ring-1 print:ring-brand-300">
            <div>
              <p className="text-sm text-brand-200 print:text-stone-500">เงินได้สุทธิ</p>
              <p className="mt-1 text-[34px] leading-none font-semibold tracking-tight tabular-nums">
                {fmtMoney(i.net)} <span className="text-lg font-normal text-brand-200 print:text-stone-500">บาท</span>
              </p>
            </div>
            <div className="text-sm text-brand-100 sm:text-right print:text-stone-600">
              <p className="text-xs text-brand-300 print:text-stone-500">โอนเข้าบัญชี</p>
              <p className="font-medium tabular-nums">
                {e.bankName ?? "-"} {maskAccount(e.bankAccount)}
              </p>
            </div>
          </section>

          {/* ข้อมูลพนักงาน */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-brand-50/60 p-4 text-sm sm:grid-cols-3 print:bg-transparent print:ring-1 print:ring-brand-100">
            {[
              ["ชื่อ-สกุล", fullName(e)],
              ["รหัสพนักงาน", e.code],
              ["ตำแหน่ง", row.pos ?? "-"],
              ["แผนก", row.dept ?? "-"],
              ["สาขา", row.branch ?? "-"],
              ["ประเภทการจ้าง", i.payType === "monthly" ? "รายเดือน" : "รายวัน"],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-stone-500">{k}</dt>
                <dd className="font-medium break-words text-brand-900">{v}</dd>
              </div>
            ))}
          </dl>

          {/* รายได้ / รายการหัก */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Lines title="รายได้" icon="logIn" tone="in" rows={incomes} total={i.gross} totalLabel="รวมรายได้" />
            <Lines title="รายการหัก" icon="logOut" tone="out" rows={deductions} total={totalDeduct} totalLabel="รวมรายการหัก" />
          </div>

          {/* สรุปการทำงาน */}
          <section className="grid grid-cols-4 divide-x divide-brand-100 rounded-2xl border border-brand-100 py-3 text-center print:break-inside-avoid">
            {[
              ["วันทำงาน", `${i.workedDays}/${i.scheduledDays}`],
              ["ลา (วัน)", leave],
              ["ขาด (วัน)", i.absentDays],
              ["สาย (นาที)", i.lateMinutes],
            ].map(([k, v]) => (
              <div key={String(k)} className="px-1">
                <p className="text-xs text-stone-500">{k}</p>
                <p className="mt-0.5 text-lg font-semibold text-brand-900 tabular-nums">{v}</p>
              </div>
            ))}
          </section>

          {/* ยอดสะสมทั้งปี */}
          <section className="rounded-2xl border border-brand-100 px-4 py-3 print:break-inside-avoid">
            <p className="text-xs font-medium text-stone-500">ยอดสะสมตั้งแต่ต้นปี {run.year + 543} ถึงงวดนี้</p>
            <div className="mt-1 grid grid-cols-3 gap-2 text-center">
              {[
                ["เงินได้สะสม", ytd.income],
                ["ประกันสังคมสะสม", ytd.sso],
                ["ภาษีสะสม", ytd.tax],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-[11px] text-stone-500">{k}</p>
                  <p className="font-semibold text-brand-900 tabular-nums">{fmtMoney(v)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-1 border-t border-brand-100 bg-brand-50/40 px-6 py-4 text-xs text-stone-500 sm:flex-row sm:justify-between sm:px-8">
          <span>เอกสารนี้ออกโดยระบบ KIN HR ไม่ต้องลงลายมือชื่อ</span>
          <span>ข้อมูลเงินเดือนเป็นความลับเฉพาะบุคคล</span>
        </footer>
      </article>
    </div>
  );
}
