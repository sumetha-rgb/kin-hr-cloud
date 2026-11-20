import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { payrollItems, payrollRuns } from "@/db/schema";
import { Icon } from "@/components/icons";
import { DesktopOnly, MobileCard, MobileList, PageHeader, Table, btn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtMonth } from "@/lib/time";
import { fmtMoney } from "@/lib/util";

export const metadata = { title: "สลิปเงินเดือน" };

export default async function MySlips() {
  const u = await requireUser();
  const rows = u.employeeId
    ? await db
        .select({ i: payrollItems, run: payrollRuns })
        .from(payrollItems)
        .innerJoin(payrollRuns, eq(payrollItems.runId, payrollRuns.id))
        .where(and(eq(payrollItems.employeeId, u.employeeId), eq(payrollRuns.status, "finalized")))
        .orderBy(desc(payrollRuns.year), desc(payrollRuns.month))
    : [];
  // ปีที่มีสลิป → ออก 50 ทวิ ของปีนั้นได้
  const years = [...new Set(rows.map(({ run }) => run.year))];
  return (
    <>
      <PageHeader
        title="สลิปเงินเดือนของฉัน"
        actions={
          years.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <Link key={y} href={`/payroll/tax/${y}/${u.employeeId}`} className={btn.secondary}>
                  <Icon name="printer" className="size-4" />
                  หนังสือรับรองภาษี (50 ทวิ) {y + 543}
                </Link>
              ))}
            </div>
          )
        }
      />
      <MobileList empty={!rows.length}>
        {rows.map(({ i, run }) => (
          <MobileCard key={i.id} href={`/payroll/${run.id}/slip/${i.employeeId}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-900">{fmtMonth(run.year, run.month)}</span>
              <span className="inline-flex items-center gap-0.5 text-sm text-brand-700">
                ดูสลิป <Icon name="chevronRight" className="size-4" />
              </span>
            </div>
            <div className="mt-1 text-[26px] font-semibold text-brand-900 tabular-nums">{fmtMoney(i.net)} ฿</div>
            <div className="text-sm text-stone-500">
              รายได้ {fmtMoney(i.gross)} · หัก {fmtMoney(Number(i.gross) - Number(i.net))}
            </div>
          </MobileCard>
        ))}
      </MobileList>
      <DesktopOnly>
        <Table head={["งวด", "รายได้", "รายการหัก", "สุทธิ", "ออกเมื่อ", ""]} empty={!rows.length}>
          {rows.map(({ i, run }) => (
            <tr key={i.id} data-href={`/payroll/${run.id}/slip/${i.employeeId}`}>
              <td className="font-medium">{fmtMonth(run.year, run.month)}</td>
              <td className="tabular-nums">{fmtMoney(i.gross)}</td>
              <td className="tabular-nums">{fmtMoney(Number(i.gross) - Number(i.net))}</td>
              <td className="font-semibold tabular-nums">{fmtMoney(i.net)}</td>
              <td className="text-stone-500">{fmtDate(run.finalizedAt)}</td>
              <td>
                <Link href={`/payroll/${run.id}/slip/${i.employeeId}`} className="text-brand-600">
                  ดูสลิป
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </DesktopOnly>
    </>
  );
}
