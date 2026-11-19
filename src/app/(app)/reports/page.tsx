import { desc } from "drizzle-orm";
import { db } from "@/db";
import { payrollRuns } from "@/db/schema";
import { Card, Field, Input, PageHeader, Select, Table, btn } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { loadAttendance } from "@/lib/attendance-data";
import { bkkDateStr, fmtDate, fmtMonth, monthRange } from "@/lib/time";
import { fullName } from "@/lib/util";

export const metadata = { title: "รายงาน" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ start?: string; end?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const today = bkkDateStr();
  const [y, m] = today.split("-").map(Number);
  const def = monthRange(y, m);
  const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const start = valid(sp.start) ? sp.start! : def.start;
  const end = valid(sp.end) && sp.end! >= start ? sp.end! : today < def.end ? today : def.end;

  const [runs, att] = await Promise.all([
    db.select().from(payrollRuns).orderBy(desc(payrollRuns.year), desc(payrollRuns.month)),
    loadAttendance({ start, end, includeResigned: true }),
  ]);
  const runOptions = runs.map((r) => ({ value: r.id, label: fmtMonth(r.year, r.month) + (r.status === "draft" ? " (ร่าง)" : "") }));

  return (
    <>
      <PageHeader title="Report" subtitle="รายงาน" />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="รายงานเวลาทำงาน">
          <form action="/api/reports/attendance" className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="ตั้งแต่">
                <Input type="date" name="start" defaultValue={start} required />
              </Field>
              <Field label="ถึง">
                <Input type="date" name="end" defaultValue={end} required />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btn.primary}>สรุปรายคน (CSV)</button>
              <button formAction="/api/reports/attendance-daily" className={btn.secondary}>
                รายวัน (CSV)
              </button>
            </div>
          </form>
        </Card>
        <Card title="รายงานเงินเดือน">
          {runs.length === 0 ? (
            <p className="text-sm text-stone-500">ยังไม่มีงวดเงินเดือน</p>
          ) : (
            <form action="/api/reports/payroll" className="space-y-2">
              <Field label="งวด">
                <Select name="runId" options={runOptions} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button className={btn.primary}>สรุปเงินเดือน</button>
                <button formAction="/api/reports/bank" className={btn.secondary}>
                  ไฟล์โอนธนาคาร
                </button>
                <button formAction="/api/reports/sso" className={btn.secondary}>
                  ประกันสังคม
                </button>
              </div>
            </form>
          )}
        </Card>
        <Card title="รายงานอื่น ๆ">
          <form action="/api/reports/leave" className="mb-3 flex items-end gap-2">
            <Field label="สรุปการลา ปี (ค.ศ.)">
              <Input type="number" name="year" defaultValue={y} className="w-28" />
            </Field>
            <button className={btn.secondary}>ดาวน์โหลด</button>
          </form>
          <a href="/api/reports/employees" className={btn.secondary}>
            รายชื่อพนักงานทั้งหมด (CSV)
          </a>
        </Card>
      </div>

      <h2 className="mb-2 font-semibold">
        สรุปเวลาทำงาน {fmtDate(start)} – {fmtDate(end)}
      </h2>
      <form className="mb-3 flex flex-wrap items-end gap-2">
        <Input type="date" name="start" defaultValue={start} className="w-auto" />
        <Input type="date" name="end" defaultValue={end} className="w-auto" />
        <button className={btn.secondary}>แสดง</button>
      </form>
      <Table head={["รหัส", "พนักงาน", "วันทำงาน", "มาทำงาน", "สาย (ครั้ง/นาที)", "ขาด", "ลา", "ลงเวลาไม่ครบ"]} empty={!att.length}>
        {att.map(({ employee: e, totals: t }) => (
          <tr key={e.id}>
            <td>{e.code}</td>
            <td>{fullName(e)}</td>
            <td>{t.scheduled}</td>
            <td>{t.worked}</td>
            <td className={t.lateCount ? "text-amber-600" : ""}>
              {t.lateCount} / {t.lateMinutes}
            </td>
            <td className={t.absent ? "font-medium text-rose-600" : ""}>{t.absent}</td>
            <td>{t.paidLeave + t.unpaidLeave}</td>
            <td className={t.incomplete ? "text-amber-600" : ""}>{t.incomplete}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
