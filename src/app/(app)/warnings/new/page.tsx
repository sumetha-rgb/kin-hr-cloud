import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { branches, employees, warnings } from "@/db/schema";
import { EmployeePicker } from "@/components/employee-picker";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Checkbox, Field, Flash, Input, MoreLink, PageHeader, Select, Textarea } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { bkkDateStr, fmtDate } from "@/lib/time";
import { cn, fullName } from "@/lib/util";
import { isActiveWarning } from "@/lib/warning";
import { getWarningConfig } from "@/lib/warning-config";
import { issueWarning } from "../actions";

export const metadata = { title: "ออกใบเตือน" };

export default async function NewWarningPage({ searchParams }: { searchParams: Promise<{ employee?: string; ok?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const empId = Number(sp.employee) || undefined;
  const [emps, history, br] = await Promise.all([
    db.select().from(employees).where(ne(employees.status, "resigned")).orderBy(asc(employees.code)),
    empId ? db.select().from(warnings).where(and(eq(warnings.employeeId, empId))).orderBy(desc(warnings.incidentDate)) : Promise.resolve([]),
    db.select({ id: branches.id, name: branches.name }).from(branches),
  ]);
  const brName = new Map(br.map((b) => [b.id, b.name]));
  const active = history.filter((w) => isActiveWarning(w));
  const cfg = await getWarningConfig();
  const levels = cfg.levels.filter((l) => l.enabled);
  // ค่าเริ่มต้น: ถ้ามีใบที่ยังมีผลอยู่ ให้เลือกระดับถัดไป
  const defaultLevel = levels[Math.min(active.length ? 1 : 0, levels.length - 1)]?.level;

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
                  {fmtDate(w.incidentDate)} · {cfg.level[w.level].name} · {w.category}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <form action={issueWarning} className="space-y-5">
        <Card title="พนักงานและเหตุการณ์">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-brand-800">พนักงาน</span>
              <EmployeePicker
                name="employeeId"
                required
                defaultValue={empId}
                syncParam="employee"
                options={emps.map((e) => ({ id: e.id, code: e.code, name: fullName(e), nickname: e.nickname, sub: brName.get(e.branchId ?? -1) }))}
              />
            </div>
            <Field label="ประเภทความผิด">
              <Select name="category" required placeholder="- เลือก -" defaultValue="" options={cfg.activeCategories.map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label="วันที่เกิดเหตุ" hint="ใบเตือนนับระยะเวลามีผลจากวันนี้">
              <Input name="incidentDate" type="date" required max={bkkDateStr()} defaultValue={bkkDateStr()} />
            </Field>
          </div>
        </Card>

        <Card title="ระดับการเตือน">
          <div className={cn("grid gap-3", levels.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {levels.map((l) => (
              <label key={l.level} className="cursor-pointer">
                <input type="radio" name="level" value={l.level} defaultChecked={l.level === defaultLevel} className="peer sr-only" required />
                <span
                  className={cn(
                    "flex h-full flex-col gap-1.5 rounded-2xl border-2 border-brand-200 bg-white p-4 transition peer-checked:shadow-sm peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100",
                    l.level === "final" ? "peer-checked:border-rose-400 peer-checked:bg-rose-50" : l.level === "written" ? "peer-checked:border-amber-400 peer-checked:bg-amber-50" : "peer-checked:border-brand-500 peer-checked:bg-brand-50",
                  )}
                >
                  <span className="self-start">
                    <Badge tone={l.tone}>{`ระดับ ${l.step}`}</Badge>
                  </span>
                  <span className="mt-1 font-semibold text-brand-900">{l.name}</span>
                  {l.description && <span className="text-xs leading-relaxed text-stone-500">{l.description}</span>}
                  <span className="mt-auto pt-1 text-xs text-stone-400">มีผล {l.validityMonths === 12 ? "1 ปี" : `${l.validityMonths} เดือน`}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-500">
            แก้ชื่อ คำอธิบาย ระยะเวลามีผล หรือข้อความในหนังสือได้ที่ <MoreLink href="/organization/warnings">ตั้งค่าองค์กร → ใบเตือน</MoreLink>
          </p>
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
