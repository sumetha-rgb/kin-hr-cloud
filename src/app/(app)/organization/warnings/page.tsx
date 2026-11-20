import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Flash, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/util";
import { getWarningConfig } from "@/lib/warning-config";
import { addWarningCategory, renameWarningCategory, saveWarningLevels, toggleWarningCategory } from "./actions";

export const metadata = { title: "ตั้งค่าใบเตือน" };

export default async function WarningSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const cfg = await getWarningConfig();

  return (
    <div className="space-y-6">
      <Flash ok={sp.ok} error={sp.error} />

      {/* ระดับการเตือน */}
      <form action={saveWarningLevels}>
        <Card title="ระดับการเตือน" subtitle="ชื่อและข้อความที่ใช้ในฟอร์มออกใบเตือนและในตัวหนังสือเตือน — มีผลกับใบที่ออกหลังจากบันทึก ใบเก่าไม่เปลี่ยน">
          <div className="grid gap-4 xl:grid-cols-3">
            {cfg.levels.map((l) => (
              <section key={l.level} className={cn("flex flex-col gap-3 rounded-2xl border p-4", l.enabled ? "border-brand-200" : "border-dashed border-stone-300 bg-stone-50/60")}>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={l.tone}>{`ระดับ ${l.step}`}</Badge>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                    เปิดใช้งาน
                    <span className="relative inline-flex">
                      <input type="checkbox" name={`${l.level}.enabled`} defaultChecked={l.enabled} className="peer sr-only" />
                      <span className="h-6 w-10 rounded-full bg-stone-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
                      <span className="absolute top-1 left-1 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </span>
                  </label>
                </div>
                <Field label="ชื่อระดับ" hint="แสดงในรายการ ป้าย และการแจ้งเตือน">
                  <Input name={`${l.level}.name`} required maxLength={60} defaultValue={l.name} />
                </Field>
                <Field label="หัวเรื่องในเอกสาร">
                  <Input name={`${l.level}.docTitle`} required maxLength={80} defaultValue={l.docTitle} />
                </Field>
                <Field label="คำอธิบายในฟอร์ม">
                  <Input name={`${l.level}.description`} maxLength={200} defaultValue={l.description} />
                </Field>
                <Field label="มีผล (เดือน)" hint="1-12 เดือน · กฎหมายกำหนดหนังสือเตือนมีผลไม่เกิน 1 ปี">
                  <Input name={`${l.level}.validityMonths`} type="number" min={1} max={12} required defaultValue={l.validityMonths} className="w-28" />
                </Field>
                <Field label="ข้อความท้ายหนังสือ" hint="ผลถ้ากระทำผิดซ้ำ">
                  <Textarea name={`${l.level}.closingText`} rows={4} maxLength={1000} defaultValue={l.closingText} />
                </Field>
              </section>
            ))}
          </div>
          <div className="mt-4">
            <SubmitButton>บันทึกระดับการเตือน</SubmitButton>
          </div>
        </Card>
      </form>

      {/* ประเภทความผิด */}
      <Card title="ประเภทความผิด" subtitle="ให้ HR เลือกตอนออกใบเตือน — ประเภทที่ปิดไว้จะไม่แสดงในฟอร์ม แต่ใบเตือนเก่ายังแสดงตามเดิม">
        <ul className="divide-y divide-brand-100 rounded-2xl border border-brand-100">
          {cfg.categories.map((c) => (
            <li key={c.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2.5", !c.active && "bg-stone-50/70")}>
              <form action={renameWarningCategory} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="id" value={c.id} />
                <Input name="name" defaultValue={c.name} maxLength={80} required className={cn("min-w-0 flex-1", !c.active && "text-stone-400")} aria-label="ชื่อประเภทความผิด" />
                <SubmitButton variant="ghost">บันทึกชื่อ</SubmitButton>
              </form>
              {!c.active && <Badge tone="gray">ปิดอยู่</Badge>}
              <form action={toggleWarningCategory}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={c.active ? "0" : "1"} />
                <SubmitButton variant={c.active ? "secondary" : "success"} className="min-h-9! px-3! text-xs!">
                  {c.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={addWarningCategory} className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="เพิ่มประเภทความผิด" className="min-w-64 flex-1">
            <Input name="name" required maxLength={80} placeholder="เช่น ใช้โทรศัพท์ขณะดูแลผู้รับบริการ" />
          </Field>
          <SubmitButton>เพิ่ม</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
