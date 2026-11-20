import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { employees, warnings } from "@/db/schema";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Checkbox, Field, Flash, Input, MoreLink, PageHeader, Select, Textarea } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { bkkDateStr, fmtDate } from "@/lib/time";
import { cn, fullName } from "@/lib/util";
import { isActiveWarning, WARNING_CATEGORIES, WARNING_LEVEL } from "@/lib/warning";
import { issueWarning } from "../actions";

export const metadata = { title: "ออกใบเตือน" };

export default async function NewWarningPage({ searchParams }: { searchParams: Promise<{ employee?: string; ok?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const empId = Number(sp.employee) || undefined;
  const [emps, history] = await Promise.all([
    db.select().from(employees).where(ne(employees.status, "resigned")).orderBy(asc(employees.code)),
    empId ? db.select().from(warnings).where(and(eq(warnings.employeeId, empId))).orderBy(desc(warnings.incidentDate)) : Promise.resolve([]),
  ]);
  const active = history.filter((w) => isActiveWarning(w));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="ออกใบเตือน" subtitle="บันทึกเป็นประวัติของพนักงาน และแจ้งให้พนักงานเปิดอ่าน/กดรับทราบในระบบ" />
      <Flash ok={sp.ok} error={sp.error} />

      {empId && active.length > 0 && (
        <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Icon name="alert" className="mt-0.5 size-5 text-amber-600" />
          <div>
            <p className="font-medium">พนักงานคนนี้มีใบเตือนที่ยังมีผลอยู่ {active.length} ใบ</p>
            <ul className="mt-1 space-y-0.5 text-amber-800">
              {active.slice(0, 3).map((w) => (
                <li key={w.id}>
                  {fmtDate(w.incidentDate)} · {WARNING_LEVEL[w.level].short} · {w.category}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <form action={issueWarning} className="space-y-5">
        <Card title="พนักงานและเหตุการณ์">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="พนักงาน" className="sm:col-span-2">
              <Select
                name="employeeId"
                required
                placeholder="- เลือกพนักงาน -"
                defaultValue={empId ?? ""}
                options={emps.map((e) => ({ value: e.id, label: `${e.code} ${fullName(e)}${e.nickname ? ` (${e.nickname})` : ""}` }))}
              />
            </Field>
            <Field label="ประเภทความผิด">
              <Select name="category" required placeholder="- เลือก -" defaultValue="" options={WARNING_CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label="วันที่เกิดเหตุ" hint="หนังสือเตือนมีผล 1 ปีนับจากวันนี้">
              <Input name="incidentDate" type="date" required max={bkkDateStr()} defaultValue={bkkDateStr()} />
            </Field>
          </div>
        </Card>

        <Card title="ระดับการเตือน">
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(WARNING_LEVEL) as Array<keyof typeof WARNING_LEVEL>).map((k, i) => (
              <label key={k} className="cursor-pointer">
                <input type="radio" name="level" value={k} defaultChecked={i === (active.length ? 1 : 0)} className="peer sr-only" required />
                <span
                  className={cn(
                    "flex h-full flex-col gap-1 rounded-2xl border-2 border-brand-200 bg-white p-4 transition peer-checked:shadow-sm peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100",
                    k === "final" ? "peer-checked:border-rose-400 peer-checked:bg-rose-50" : k === "written" ? "peer-checked:border-amber-400 peer-checked:bg-amber-50" : "peer-checked:border-brand-500 peer-checked:bg-brand-50",
                  )}
                >
                  <Badge tone={WARNING_LEVEL[k].tone}>{`ระดับ ${i + 1}`}</Badge>
                  <span className="mt-1 font-semibold text-brand-900">{WARNING_LEVEL[k].short}</span>
                  <span className="text-xs text-stone-500">
                    {k === "verbal" ? "ความผิดเล็กน้อย บันทึกไว้เป็นประวัติ" : k === "written" ? "เป็นลายลักษณ์อักษร มีผล 1 ปี" : "หากทำผิดซ้ำ อาจพิจารณาเลิกจ้าง"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card title="รายละเอียด">
          <div className="space-y-4">
            <Field label="เหตุผล / รายละเอียดการกระทำผิด" hint="ระบุข้อเท็จจริง วัน เวลา สถานที่ และระเบียบที่ฝ่าฝืน — พนักงานจะเห็นข้อความนี้">
              <Textarea name="reason" rows={5} required minLength={10} maxLength={2000} placeholder="เช่น วันที่ 12 พ.ย. 2569 มาทำงานสาย 45 นาทีโดยไม่แจ้งล่วงหน้า เป็นครั้งที่ 3 ในเดือนนี้ ฝ่าฝืนระเบียบข้อ…" />
            </Field>
            <Field label="สิ่งที่ต้องปรับปรุง / มาตรการ (ไม่บังคับ)">
              <Textarea name="action" rows={3} maxLength={1000} placeholder="เช่น ให้มาถึงก่อนเวลาเข้างาน 10 นาที หากมีเหตุจำเป็นให้แจ้งหัวหน้าล่วงหน้า" />
            </Field>
            <Checkbox name="notify" label="แจ้งพนักงานทันที (แจ้งเตือนในระบบ และเด้งบนมือถือถ้าเปิดไว้)" defaultChecked />
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant="danger" confirm="ยืนยันออกใบเตือนนี้? ใบเตือนจะถูกบันทึกเป็นประวัติของพนักงาน">
            ออกใบเตือน
          </SubmitButton>
          <MoreLink href="/warnings">ดูสรุปใบเตือนทั้งหมด</MoreLink>
        </div>
      </form>
    </div>
  );
}
