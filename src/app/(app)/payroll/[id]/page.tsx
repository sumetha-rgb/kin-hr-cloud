import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { db } from "@/db";
import { employees, payrollItems, payrollRuns } from "@/db/schema";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Flash, PageHeader, Stat, Table, btn } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { fmtDateTime, fmtMonth } from "@/lib/time";
import { fmtMoney, fullName } from "@/lib/util";
import { adjustItem, deleteRun, finalizeRun, recalcRun, reopenRun } from "../actions";

export default async function RunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireRole("admin", "hr");
  const { id } = await params;
  const sp = await searchParams;
  const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, Number(id)));
  if (!run) notFound();
  const items = await db
    .select({ i: payrollItems, e: employees })
    .from(payrollItems)
    .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
    .where(eq(payrollItems.runId, run.id))
    .orderBy(asc(employees.code));
  const total = (k: keyof typeof payrollItems.$inferSelect) => items.reduce((a, { i }) => a.plus(String(i[k] ?? 0)), new Decimal(0));
  const draft = run.status === "draft";

  return (
    <>
      <PageHeader
        title={`เงินเดือน ${fmtMonth(run.year, run.month)}`}
        subtitle={`คำนวณล่าสุด ${fmtDateTime(run.calculatedAt)}${run.finalizedAt ? ` · ปิดงวด ${fmtDateTime(run.finalizedAt)}` : ""}`}
        actions={
          <>
            <a href={`/api/reports/payroll?runId=${run.id}`} className={btn.secondary}>
              Excel (CSV)
            </a>
            <a href={`/api/reports/bank?runId=${run.id}`} className={btn.secondary}>
              ไฟล์โอนธนาคาร
            </a>
            <a href={`/api/reports/sso?runId=${run.id}`} className={btn.secondary}>
              ประกันสังคม
            </a>
            {draft ? (
              <>
                <form action={recalcRun}>
                  <input type="hidden" name="id" value={run.id} />
                  <SubmitButton variant="secondary">คำนวณใหม่</SubmitButton>
                </form>
                <form action={finalizeRun}>
                  <input type="hidden" name="id" value={run.id} />
                  <SubmitButton confirm="ปิดงวดแล้วจะแก้ไขไม่ได้ และพนักงานจะเห็นสลิป ยืนยัน?">ปิดงวด</SubmitButton>
                </form>
                <form action={deleteRun}>
                  <input type="hidden" name="id" value={run.id} />
                  <SubmitButton variant="ghost" confirm="ลบงวดนี้?">
                    ลบ
                  </SubmitButton>
                </form>
              </>
            ) : (
              u.role === "admin" && (
                <form action={reopenRun}>
                  <input type="hidden" name="id" value={run.id} />
                  <SubmitButton variant="ghost" confirm="เปิดงวดให้แก้ไขอีกครั้ง?">
                    เปิดงวดใหม่
                  </SubmitButton>
                </form>
              )
            )}
          </>
        }
      />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="พนักงาน" value={items.length} />
        <Stat label="รายได้รวม" value={fmtMoney(total("gross"))} />
        <Stat label="ประกันสังคม" value={fmtMoney(total("sso"))} hint="ส่วนลูกจ้าง (นายจ้างสมทบเท่ากัน)" />
        <Stat label="ภาษีหัก ณ ที่จ่าย" value={fmtMoney(total("tax"))} />
        <Stat label="จ่ายสุทธิ" value={fmtMoney(total("net"))} tone="good" />
      </div>
      {draft && <p className="mb-2 text-xs text-stone-500">กรอก “รายได้อื่น / รายหักอื่น” แล้วกดบันทึกในแถว ระบบจะคำนวณภาษีและยอดสุทธิใหม่</p>}
      {/* 14 ค่าเดิม จัดกลุ่มเหลือ 7 คอลัมน์ให้พอดีจอ (ไม่ต้องเลื่อนซ้าย-ขวา) */}
      <Table head={["พนักงาน", "การทำงาน", "เงินได้", "รายได้อื่น / รายหักอื่น", "รายการหัก", "สุทธิ", ""]} empty={!items.length}>
        {items.map(({ i, e }) => {
          const unpaid = i.absentDays + Number(i.unpaidLeaveDays);
          const work = [
            unpaid ? `ขาด ${unpaid}` : null,
            Number(i.paidLeaveDays) ? `ลา ${Number(i.paidLeaveDays)}` : null,
            i.lateMinutes ? `สาย ${i.lateMinutes} น.` : null,
            Number(i.otHours) ? `OT ${Number(i.otHours)} ชม.` : null,
          ].filter(Boolean);
          const deduct = new Decimal(i.lateDeduction).plus(i.sso).plus(i.tax);
          return (
            <tr key={i.id}>
              <td>
                <span className="block font-medium text-brand-900">{fullName(e)}</span>
                <span className="block text-xs font-normal text-stone-500">
                  {e.code} · {i.payType === "monthly" ? "รายเดือน" : "รายวัน"} {fmtMoney(i.baseSalary)}
                </span>
              </td>
              <td>
                <span className="block tabular-nums">
                  {i.workedDays}/{i.scheduledDays} วัน
                </span>
                {work.length > 0 && <span className="block text-xs text-stone-500">{work.join(" · ")}</span>}
              </td>
              <td className="tabular-nums">
                <span className="block">{fmtMoney(new Decimal(i.earnedSalary).plus(i.allowance).plus(i.otAmount))}</span>
                {Number(i.otAmount) > 0 && <span className="block text-xs text-stone-500">รวม OT {fmtMoney(i.otAmount)}</span>}
              </td>
              <td>
                {draft ? (
                  <form action={adjustItem} className="ml-auto grid max-w-56 grid-cols-[1fr_auto] items-center gap-1.5 md:ml-0">
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="itemId" value={i.id} />
                    <label className="contents">
                      <span className="sr-only">รายได้อื่น</span>
                      <input
                        name="otherIncome"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={i.otherIncome}
                        placeholder="+ รายได้"
                        className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1 text-right text-xs text-emerald-700 tabular-nums focus:border-brand-400 focus:outline-none"
                      />
                    </label>
                    <button className="row-span-2 h-full rounded-lg bg-brand-100 px-2.5 text-xs font-medium text-brand-800 hover:bg-brand-200">บันทึก</button>
                    <label className="contents">
                      <span className="sr-only">รายหักอื่น</span>
                      <input
                        name="otherDeduction"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={i.otherDeduction}
                        placeholder="− รายหัก"
                        className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1 text-right text-xs text-rose-700 tabular-nums focus:border-brand-400 focus:outline-none"
                      />
                    </label>
                  </form>
                ) : (
                  <span className="tabular-nums">
                    <span className="block text-emerald-700">+{fmtMoney(i.otherIncome)}</span>
                    <span className="block text-rose-700">−{fmtMoney(i.otherDeduction)}</span>
                  </span>
                )}
              </td>
              <td className="tabular-nums">
                <span className="block">{fmtMoney(deduct)}</span>
                <span className="block text-xs text-stone-500">
                  ปกส. {fmtMoney(i.sso)} · ภาษี {fmtMoney(i.tax)}
                  {Number(i.lateDeduction) ? ` · สาย ${fmtMoney(i.lateDeduction)}` : ""}
                </span>
              </td>
              <td className="text-base font-semibold text-brand-900 tabular-nums">{fmtMoney(i.net)}</td>
              <td className="text-right">
                <Link href={`/payroll/${run.id}/slip/${e.id}`} className="inline-flex items-center gap-1 rounded-full border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                  <Icon name="document" className="size-3.5" />
                  สลิป
                </Link>
              </td>
            </tr>
          );
        })}
      </Table>
      {!draft && (
        <p className="mt-3">
          <Badge tone="green">ปิดงวดแล้ว</Badge> <span className="text-sm text-stone-500">พนักงานดูสลิปได้ที่เมนู “สลิปเงินเดือน”</span>
        </p>
      )}
    </>
  );
}
