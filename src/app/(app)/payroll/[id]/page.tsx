import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { db } from "@/db";
import { employees, payrollItems, payrollRuns } from "@/db/schema";
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
      <Table
        head={["รหัส", "พนักงาน", "ฐาน", "วันทำงาน", "ขาด/ลาไม่รับเงิน", "สาย(น.)", "OT", "เงินได้", "รายได้อื่น / รายหักอื่น", "หักสาย", "ปกส.", "ภาษี", "สุทธิ", ""]}
        empty={!items.length}
      >
        {items.map(({ i, e }) => (
          <tr key={i.id}>
            <td>{e.code}</td>
            <td className="whitespace-nowrap">
              {fullName(e)}
              <div className="text-xs text-stone-400">{i.payType === "monthly" ? "รายเดือน" : "รายวัน"}</div>
            </td>
            <td className="tabular-nums">{fmtMoney(i.baseSalary)}</td>
            <td>
              {i.workedDays}/{i.scheduledDays}
              {Number(i.paidLeaveDays) > 0 && <div className="text-xs text-stone-400">ลา {Number(i.paidLeaveDays)}</div>}
            </td>
            <td>{i.absentDays + Number(i.unpaidLeaveDays) || "-"}</td>
            <td>{i.lateMinutes || "-"}</td>
            <td className="tabular-nums">
              {Number(i.otHours) ? (
                <>
                  {fmtMoney(i.otAmount)}
                  <div className="text-xs text-stone-400">{Number(i.otHours)} ชม.</div>
                </>
              ) : (
                "-"
              )}
            </td>
            <td className="tabular-nums">{fmtMoney(new Decimal(i.earnedSalary).plus(i.allowance))}</td>
            <td>
              {draft ? (
                <form action={adjustItem} className="flex items-center gap-1">
                  <input type="hidden" name="runId" value={run.id} />
                  <input type="hidden" name="itemId" value={i.id} />
                  <input name="otherIncome" type="number" step="0.01" min={0} defaultValue={i.otherIncome} className="w-24 rounded border border-stone-300 px-1.5 py-1 text-right text-xs" />
                  <input name="otherDeduction" type="number" step="0.01" min={0} defaultValue={i.otherDeduction} className="w-24 rounded border border-stone-300 px-1.5 py-1 text-right text-xs" />
                  <button className="rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200">บันทึก</button>
                </form>
              ) : (
                <span className="tabular-nums">
                  +{fmtMoney(i.otherIncome)} / -{fmtMoney(i.otherDeduction)}
                </span>
              )}
            </td>
            <td className="tabular-nums">{Number(i.lateDeduction) ? fmtMoney(i.lateDeduction) : "-"}</td>
            <td className="tabular-nums">{fmtMoney(i.sso)}</td>
            <td className="tabular-nums">{fmtMoney(i.tax)}</td>
            <td className="font-semibold tabular-nums">{fmtMoney(i.net)}</td>
            <td>
              <Link href={`/payroll/${run.id}/slip/${e.id}`} className="text-xs text-brand-600">
                สลิป
              </Link>
            </td>
          </tr>
        ))}
      </Table>
      {!draft && (
        <p className="mt-3">
          <Badge tone="green">ปิดงวดแล้ว</Badge> <span className="text-sm text-stone-500">พนักงานดูสลิปได้ที่เมนู “สลิปเงินเดือน”</span>
        </p>
      )}
    </>
  );
}
