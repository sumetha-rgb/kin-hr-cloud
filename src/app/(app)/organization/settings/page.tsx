import { SubmitButton } from "@/components/submit-button";
import { Card, Checkbox, Field, Flash, Input, Textarea } from "@/components/ui";
import { getSettings } from "@/lib/payroll-run";
import { saveSettings } from "../actions";

export const metadata = { title: "ตั้งค่าบริษัท" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="max-w-3xl">
      <Flash ok={sp.ok} error={sp.error} />
      <form action={saveSettings} className="space-y-5">
        <Card title="ข้อมูลบริษัท">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อบริษัท">
              <Input name="name" required defaultValue={s.name} />
            </Field>
            <Field label="เลขประจำตัวผู้เสียภาษี">
              <Input name="taxId" defaultValue={s.taxId ?? ""} />
            </Field>
            <Field label="ที่อยู่" className="sm:col-span-2">
              <Textarea name="address" defaultValue={s.address ?? ""} />
            </Field>
          </div>
        </Card>
        <Card title="ประกันสังคม">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="อัตราเงินสมทบ (%)">
              <Input name="ssoRate" type="number" step="0.01" defaultValue={s.ssoRate} />
            </Field>
            <Field label="ฐานค่าจ้างต่ำสุด (บาท)">
              <Input name="ssoMinBase" type="number" step="0.01" defaultValue={s.ssoMinBase} />
            </Field>
            <Field label="ฐานค่าจ้างสูงสุด (บาท)">
              <Input name="ssoMaxBase" type="number" step="0.01" defaultValue={s.ssoMaxBase} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-amber-700">
            ⚠️ ตรวจสอบเพดานค่าจ้างตามประกาศสำนักงานประกันสังคมฉบับล่าสุดก่อนคำนวณเงินเดือน (มีแผนปรับเพดานขึ้นเป็นขั้น ๆ)
          </p>
        </Card>
        <Card title="การลงเวลาและการหักเงิน">
          <div className="space-y-3">
            <Checkbox name="deductLate" label="หักเงินเมื่อมาสาย (คิดตามนาทีจากค่าจ้างรายชั่วโมง)" defaultChecked={s.deductLate} />
            <Field label="ความแม่นยำ GPS ที่ยอมรับ (เมตร)" hint="ถ้า GPS มือถือคลาดเคลื่อนมากกว่านี้ จะไม่ให้ลงเวลา" className="max-w-xs">
              <Input name="maxGpsAccuracyM" type="number" min={10} defaultValue={s.maxGpsAccuracyM} />
            </Field>
          </div>
        </Card>
        <SubmitButton>บันทึกการตั้งค่า</SubmitButton>
      </form>
    </div>
  );
}
