import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Decimal from "decimal.js";
import { db } from "@/db";
import { branches, departments, employees, payrollItems, payrollRuns, positions } from "@/db/schema";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/payroll-run";
import { fmtMonth } from "@/lib/time";
import { fmtMoney, fullName } from "@/lib/util";

export const metadata = { title: "สลิปเงินเดือน" };

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
  const company = await getSettings();
  const { i, run, e } = row;

  const incomes: Array<[string, string]> = [
    [i.payType === "monthly" ? "เงินเดือน" : `ค่าจ้าง (${i.workedDays} วัน)`, i.earnedSalary],
    ["ค่าล่วงเวลา (OT)", i.otAmount],
    ["เงินเพิ่ม", i.allowance],
    ["รายได้อื่น", i.otherIncome],
  ];
  const deductions: Array<[string, string]> = [
    ["หักมาสาย", i.lateDeduction],
    ["ประกันสังคม", i.sso],
    ["ภาษีหัก ณ ที่จ่าย", i.tax],
    ["รายหักอื่น", i.otherDeduction],
  ];
  const totalDeduct = deductions.reduce((a, [, v]) => a.plus(v), new Decimal(0));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-3 flex justify-end">
        <PrintButton />
      </div>
      <div className="rounded-xl border border-stone-300 bg-white p-6 text-sm print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="text-lg font-semibold">{company.name}</div>
            {company.address && <div className="text-xs text-stone-500">{company.address}</div>}
          </div>
          <div className="text-right">
            <div className="font-semibold">ใบแจ้งเงินเดือน</div>
            <div className="text-stone-500">{fmtMonth(run.year, run.month)}</div>
            {run.status !== "finalized" && <div className="text-xs font-semibold text-amber-600">ฉบับร่าง</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-b py-3">
          <div>
            <span className="text-stone-500">ชื่อ:</span> {fullName(e)}
          </div>
          <div>
            <span className="text-stone-500">รหัส:</span> {e.code}
          </div>
          <div>
            <span className="text-stone-500">แผนก:</span> {row.dept ?? "-"}
          </div>
          <div>
            <span className="text-stone-500">ตำแหน่ง:</span> {row.pos ?? "-"}
          </div>
          <div>
            <span className="text-stone-500">สาขา:</span> {row.branch ?? "-"}
          </div>
          <div>
            <span className="text-stone-500">บัญชี:</span> {e.bankName ?? ""} {e.bankAccount ?? "-"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 py-3">
          <div>
            <div className="mb-1 font-semibold">รายได้</div>
            {incomes.map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="tabular-nums">{fmtMoney(v)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
              <span>รวมรายได้</span>
              <span className="tabular-nums">{fmtMoney(i.gross)}</span>
            </div>
          </div>
          <div>
            <div className="mb-1 font-semibold">รายการหัก</div>
            {deductions.map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="tabular-nums">{fmtMoney(v)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
              <span>รวมรายการหัก</span>
              <span className="tabular-nums">{fmtMoney(totalDeduct)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
          <span className="font-semibold">เงินได้สุทธิ</span>
          <span className="text-xl font-bold text-brand-700 tabular-nums">{fmtMoney(i.net)} บาท</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs text-stone-500">
          <div>
            วันทำงาน
            <div className="text-sm text-stone-800">
              {i.workedDays}/{i.scheduledDays}
            </div>
          </div>
          <div>
            ลา
            <div className="text-sm text-stone-800">{Number(i.paidLeaveDays) + Number(i.unpaidLeaveDays)}</div>
          </div>
          <div>
            ขาด
            <div className="text-sm text-stone-800">{i.absentDays}</div>
          </div>
          <div>
            สาย (นาที)
            <div className="text-sm text-stone-800">{i.lateMinutes}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
