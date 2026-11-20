import Link from "next/link";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Card, Flash, Textarea } from "@/components/ui";
import { LOCK_MAX, LOCK_MIN } from "@/lib/lockout";
import { getSettings } from "@/lib/payroll-run";
import { fmtDateTime } from "@/lib/time";
import { clearAnnouncement, publishAnnouncement } from "../actions";

export const metadata = { title: "ดูแลระบบ · ตั้งค่าระบบ" };

export default async function SystemSettings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="max-w-3xl">
      <Flash ok={sp.ok} error={sp.error} />
      <div className="space-y-5">
        <Card title="ประกาศถึงพนักงาน" subtitle="กด “ประกาศ” แล้วข้อความจะขึ้นเป็นแถบด้านบนของหน้าหลักทุกคน และส่งแจ้งเตือนถึงทุกบัญชี (ในระบบ + เด้งบนมือถือที่เปิดรับไว้)">
          {s.announcement && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-xs font-medium text-amber-700">กำลังแสดงอยู่ที่หน้าหลัก · ประกาศเมื่อ {fmtDateTime(s.updatedAt)}</p>
              <p className="mt-1 text-[15px] whitespace-pre-line text-brand-900">{s.announcement}</p>
              <form action={clearAnnouncement} className="mt-3">
                <SubmitButton variant="secondary" confirm="เอาประกาศนี้ออกจากหน้าหลัก?">
                  เอาประกาศลง
                </SubmitButton>
              </form>
            </div>
          )}
          <form action={publishAnnouncement} className="space-y-3" key={s.updatedAt.getTime()}>
            <Textarea name="announcement" rows={3} maxLength={500} required placeholder="เช่น วันที่ 5 ธ.ค. หยุดชดเชย · กรุณาลงทะเบียนมือถือสแกนนิ้วภายในวันศุกร์นี้" />
            <SubmitButton confirm="ส่งประกาศนี้ถึงพนักงานทุกคน?">
              <Icon name="megaphone" className="size-4" />
              ประกาศ
            </SubmitButton>
          </form>
        </Card>

        <Card title="การเข้าสู่ระบบ">
          <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-800">
            <b>ล็อกบัญชีอัตโนมัติ:</b> ใส่รหัสผิด {LOCK_MAX} ครั้งภายใน {LOCK_MIN} นาที บัญชีจะถูกล็อก {LOCK_MIN} นาที — HR ปลดล็อกได้ที่{" "}
            <Link href="/admin/users?filter=locked" className="font-medium text-brand-600 underline underline-offset-4">
              บัญชีผู้ใช้
            </Link>
          </div>
        </Card>
      </div>

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
