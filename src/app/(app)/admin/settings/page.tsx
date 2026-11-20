import Link from "next/link";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Card, Flash, Textarea } from "@/components/ui";
import { LOCK_MAX, LOCK_MIN } from "@/lib/lockout";
import { getSettings } from "@/lib/payroll-run";
import { fmtDateTime } from "@/lib/time";
import { saveSystemSettings } from "../actions";

export const metadata = { title: "ดูแลระบบ · ตั้งค่าระบบ" };

/** สวิตช์เปิด/ปิด (checkbox ที่หน้าตาเป็น toggle) */
function Toggle({ name, label, desc, defaultChecked, danger }: { name: string; label: string; desc: React.ReactNode; defaultChecked: boolean; danger?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-brand-200 bg-white p-4 transition hover:border-brand-300">
      <span className="min-w-0">
        <span className="block font-medium text-brand-900">{label}</span>
        <span className="mt-0.5 block text-sm text-stone-500">{desc}</span>
        {danger && (
          <span className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-rose-700">
            <Icon name="alert" className="size-4" />
            {danger}
          </span>
        )}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-stone-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
        <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default async function SystemSettings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="max-w-3xl">
      <Flash ok={sp.ok} error={sp.error} />
      <form action={saveSystemSettings} className="space-y-5">
        <Card title="การเข้าสู่ระบบ" subtitle="ความปลอดภัยของบัญชีผู้ใช้">
          <div className="space-y-3">
            <Toggle
              name="demoLogin"
              label="แสดงปุ่มบัญชีทดลองที่หน้าเข้าสู่ระบบ"
              desc="ปุ่ม “HR (ทดลอง)” และ “พนักงาน (ทดลอง)” กดเข้าระบบได้ทันทีโดยไม่ต้องใส่รหัส — ใช้สำหรับสาธิตระบบเท่านั้น"
              defaultChecked={s.demoLogin}
              danger={s.demoLogin ? "ตอนนี้เปิดอยู่: ใครเปิดเว็บก็เข้าเป็น HR ได้ ต้องปิดก่อนใช้กับข้อมูลพนักงานจริง" : undefined}
            />
            <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-800">
              <b>ล็อกบัญชีอัตโนมัติ:</b> ใส่รหัสผิด {LOCK_MAX} ครั้งภายใน {LOCK_MIN} นาที บัญชีจะถูกล็อก {LOCK_MIN} นาที — HR ปลดล็อกได้ที่{" "}
              <Link href="/admin/users?filter=locked" className="font-medium text-brand-600 underline underline-offset-4">
                บัญชีผู้ใช้
              </Link>
            </div>
          </div>
        </Card>

        <Card title="โปรไฟล์พนักงาน">
          <Toggle
            name="selfProfileEdit"
            label="พนักงานแก้โปรไฟล์และรูปของตัวเองได้"
            desc="ชื่อเล่น เบอร์โทร อีเมล LINE ID ที่อยู่ ผู้ติดต่อฉุกเฉิน แนะนำตัว และรูปโปรไฟล์ — ถ้าปิด จะแก้ได้เฉพาะ HR"
            defaultChecked={s.selfProfileEdit}
          />
        </Card>

        <Card title="ประกาศถึงพนักงาน" subtitle="แสดงเป็นแถบด้านบนของหน้าหลักทุกคน — เว้นว่างเพื่อไม่แสดง">
          <Textarea name="announcement" rows={3} maxLength={500} defaultValue={s.announcement ?? ""} placeholder="เช่น วันที่ 5 ธ.ค. หยุดชดเชย · กรุณาลงทะเบียนมือถือสแกนนิ้วภายในวันศุกร์นี้" />
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>บันทึกการตั้งค่าระบบ</SubmitButton>
          <span className="text-xs text-stone-500">แก้ไขล่าสุด {fmtDateTime(s.updatedAt)}</span>
        </div>
      </form>

      <Card title="การตั้งค่าอื่น ๆ" className="mt-6">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["/organization/settings", "ข้อมูลบริษัท · ประกันสังคม · ความแม่นยำ GPS"],
            ["/organization/branches", "สาขาและพิกัดลงเวลา"],
            ["/organization/shifts", "กะการทำงาน"],
            ["/organization/leave-types", "ประเภทการลาและโควตา"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="flex items-center justify-between rounded-2xl border border-brand-200 px-4 py-3 font-medium text-brand-800 transition hover:bg-brand-50">
              {label} <Icon name="chevronRight" className="size-4 text-brand-400" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
