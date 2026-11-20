import type { employeeLicenses } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Field, Input } from "@/components/ui";
import { LICENSE_PRESETS, licenseStatus } from "@/lib/license";
import { fmtDate } from "@/lib/time";
import { deleteLicense, saveLicense } from "../actions";

type License = typeof employeeLicenses.$inferSelect;

/** ฟอร์มเพิ่มใบอนุญาต (พิมพ์ชื่อเองหรือเลือกจากรายการที่ใช้บ่อย) */
export function LicenseForm({ employeeId, back, picker }: { employeeId?: number; back: string; picker?: React.ReactNode }) {
  return (
    <form action={saveLicense} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="back" value={back} />
      {employeeId ? <input type="hidden" name="employeeId" value={employeeId} /> : <div className="sm:col-span-2">{picker}</div>}
      <Field label="ชื่อใบอนุญาต / ใบรับรอง" className="sm:col-span-2">
        <Input name="name" list="license-presets" required placeholder="เช่น ใบอนุญาตประกอบวิชาชีพการพยาบาล" />
        <datalist id="license-presets">
          {LICENSE_PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="เลขที่">
        <Input name="licenseNo" />
      </Field>
      <Field label="วันออก">
        <Input name="issuedAt" type="date" />
      </Field>
      <Field label="วันหมดอายุ" hint="เว้นว่าง = ไม่มีวันหมดอายุ">
        <Input name="expiresAt" type="date" />
      </Field>
      <Field label="หมายเหตุ">
        <Input name="note" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>เพิ่มใบอนุญาต</SubmitButton>
      </div>
    </form>
  );
}

/** รายการใบอนุญาตของพนักงาน 1 คน พร้อมสถานะวันหมดอายุ */
export function LicenseList({ items, back }: { items: License[]; back: string }) {
  if (!items.length) return <p className="text-sm text-stone-500">ยังไม่มีข้อมูล</p>;
  return (
    <ul className="divide-y divide-brand-100">
      {items.map((l) => {
        const st = licenseStatus(l.expiresAt);
        return (
          <li key={l.id} className="flex items-start justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block font-medium text-brand-900">{l.name}</span>
              <span className="text-xs text-stone-500">
                {l.licenseNo ? `เลขที่ ${l.licenseNo} · ` : ""}
                {l.expiresAt ? `หมดอายุ ${fmtDate(l.expiresAt)}` : "ไม่มีวันหมดอายุ"}
                {l.note ? ` · ${l.note}` : ""}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={st.tone}>{st.label}</Badge>
              <form action={deleteLicense}>
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton variant="ghost" confirm={`ลบ ${l.name}?`}>
                  ลบ
                </SubmitButton>
              </form>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
