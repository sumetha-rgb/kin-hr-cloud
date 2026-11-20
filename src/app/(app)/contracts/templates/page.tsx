import { asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { contractTemplates } from "@/db/schema";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Checkbox, Field, Flash, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { cn } from "@/lib/util";
import { saveContractTemplate } from "../actions";

export const metadata = { title: "แม่แบบสัญญาจ้าง" };

export default async function ContractTemplates({ searchParams }: { searchParams: Promise<{ t?: string; ok?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const list = await db.select().from(contractTemplates).orderBy(asc(contractTemplates.sortOrder), asc(contractTemplates.id));
  const edit = sp.t === "new" ? null : (list.find((t) => t.id === Number(sp.t)) ?? list[0]);
  const isNew = sp.t === "new";

  return (
    <>
      <PageHeader
        title="แม่แบบสัญญาจ้าง"
        subtitle="ข้อความหลักของสัญญา (ข้อ 1-24) เป็นมาตรฐานเดียวกัน · แก้ได้เฉพาะส่วนที่ต่างกันตามตำแหน่ง · แก้แล้วไม่กระทบสัญญาที่ออกไปแล้ว"
      />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <nav className="space-y-1">
          <Link href="/contracts" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
            <Icon name="chevronLeft" className="size-4" /> สัญญาจ้าง
          </Link>
          {list.map((t) => (
            <Link
              key={t.id}
              href={`?t=${t.id}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm",
                !isNew && edit?.id === t.id ? "bg-brand-900 font-medium text-white" : "text-stone-700 hover:bg-brand-50",
              )}
            >
              <span className="truncate">{t.name}</span>
              {!t.active && <Badge tone="gray">ปิด</Badge>}
            </Link>
          ))}
          <Link href="?t=new" className={cn("block rounded-2xl px-3 py-2 text-sm", isNew ? "bg-brand-900 font-medium text-white" : "text-brand-700 hover:bg-brand-50")}>
            + เพิ่มแม่แบบ
          </Link>
        </nav>

        <form action={saveContractTemplate} className="space-y-5" key={isNew ? "new" : edit?.id}>
          {!isNew && edit && <input type="hidden" name="id" value={edit.id} />}
          <Card title={isNew ? "แม่แบบใหม่" : `แก้ไข: ${edit?.name}`}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="ชื่อแม่แบบ" className="sm:col-span-2">
                <Input name="name" required defaultValue={isNew ? "" : edit?.name} />
              </Field>
              <Field label="รหัสแบบฟอร์ม" hint="แสดงท้ายกระดาษ">
                <Input name="docCode" defaultValue={isNew ? "" : (edit?.docCode ?? "")} placeholder="HR-2025-CT-000" />
              </Field>
              <Field label="ทดลองงาน (วัน)">
                <Input name="probationDays" type="number" min={0} max={365} defaultValue={isNew ? 119 : edit?.probationDays} />
              </Field>
            </div>
            <div className="mt-3">
              <Checkbox name="active" label="เปิดใช้ (แสดงในตัวเลือกตอนออกสัญญา)" defaultChecked={isNew ? true : edit?.active} />
            </div>
          </Card>

          <Card title="ข้อ 9. วัน และเวลาทำงาน" subtitle="บรรทัดละ 1 ข้อย่อย เช่น (1) … (2) …">
            <Textarea name="workTerms" rows={6} defaultValue={isNew ? "" : edit?.workTerms} />
          </Card>
          <Card title="ข้อ 10. วันหยุด" subtitle="ข้อย่อยลึกขึ้นใช้ (2.1) (2.2) …">
            <Textarea name="holidayTerms" rows={8} defaultValue={isNew ? "" : edit?.holidayTerms} />
          </Card>
          <Card title="ข้อ 12. ค่าจ้าง และสวัสดิการ">
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
              <Field label="รายการค่าจ้าง (บรรทัดละ 1 รายการ)">
                <Textarea name="payLabels" rows={6} defaultValue={isNew ? "ค่าฐานเงินเดือน" : edit?.payLabels} />
              </Field>
              <Field label="หน่วย">
                <Select
                  name="payUnit"
                  defaultValue={isNew ? "ต่อเดือน" : edit?.payUnit}
                  options={["ต่อเดือน", "ต่อเวร", "ต่อวัน"].map((x) => ({ value: x, label: x }))}
                />
              </Field>
            </div>
            <Field label="เงื่อนไขข้อตกลงอื่น ๆ (ค่าเริ่มต้น · บรรทัดละ 1 ข้อ)" className="mt-3">
              <Textarea name="conditions" rows={4} defaultValue={isNew ? "" : edit?.conditions} />
            </Field>
          </Card>
          <Card title="ข้อเพิ่มเติมท้ายสัญญา (ถ้ามี)" subtitle="เช่น ข้อผูกพันการทำงานอย่างน้อย 1 ปี — จะเป็นข้อ 25">
            <Field label="หัวข้อ">
              <Input name="extraClauseTitle" defaultValue={isNew ? "" : (edit?.extraClauseTitle ?? "")} />
            </Field>
            <Field label="ข้อความ" className="mt-3">
              <Textarea name="extraClause" rows={4} defaultValue={isNew ? "" : (edit?.extraClause ?? "")} />
            </Field>
          </Card>
          <SubmitButton>บันทึกแม่แบบ</SubmitButton>
        </form>
      </div>
    </>
  );
}
