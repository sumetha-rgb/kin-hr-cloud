import { asc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { contractTemplates, departments, employees, positions } from "@/db/schema";
import { EmployeePicker } from "@/components/employee-picker";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, Flash, Input, PageHeader, Select, Textarea, btn } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/payroll-run";
import { bkkDateStr } from "@/lib/time";
import { fullName } from "@/lib/util";
import { createContract } from "../actions";

export const metadata = { title: "ออกสัญญาจ้าง" };

const ADDR: Array<[string, string]> = [
  ["addrNo", "เลขที่"],
  ["addrSubdistrict", "ตำบล/แขวง"],
  ["addrDistrict", "อำเภอ/เขต"],
  ["addrProvince", "จังหวัด"],
  ["addrZip", "รหัสไปรษณีย์"],
];

export default async function NewContract({ searchParams }: { searchParams: Promise<{ employee?: string; template?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const [emps, templates, company] = await Promise.all([
    db.select().from(employees).where(ne(employees.status, "resigned")).orderBy(asc(employees.code)),
    db.select().from(contractTemplates).where(eq(contractTemplates.active, true)).orderBy(asc(contractTemplates.sortOrder), asc(contractTemplates.id)),
    getSettings(),
  ]);
  const empId = Number(sp.employee) || null;
  const tplId = Number(sp.template) || null;
  const [picked] = empId
    ? await db
        .select({ e: employees, pos: positions.name, dept: departments.name })
        .from(employees)
        .leftJoin(positions, eq(employees.positionId, positions.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .where(eq(employees.id, empId))
    : [];
  const tpl = templates.find((t) => t.id === tplId);
  const labels = (tpl?.payLabels ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const e = picked?.e;
  // ช่องที่สัญญาต้องใช้แต่ยังไม่กรอกในข้อมูลพนักงาน
  const missing = e ? [!e.nationalId && "เลขบัตรประชาชน", !e.birthDate && "วันเกิด", !e.phone && "เบอร์โทร", ...ADDR.filter(([k]) => !e[k as keyof typeof e]).map(([, l]) => `ที่อยู่: ${l}`)].filter(Boolean) : [];
  const defaultPay = (i: number) => (i === 0 && e && Number(e.baseSalary) > 0 ? Number(e.baseSalary) : "");

  return (
    <>
      <PageHeader title="ออกสัญญาจ้าง" subtitle="1) เลือกพนักงานและแม่แบบ  2) ตรวจ/กรอกค่าจ้างและเงื่อนไข  3) ออกสัญญา แล้วพิมพ์ต้นฉบับ + สำเนา" />
      <Flash error={sp.error} />

      {/* ขั้นที่ 1: เลือกพนักงาน + แม่แบบ */}
      <Card title="1. เลือกพนักงานและแม่แบบสัญญา" className="mb-5">
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <span className="mb-1 block text-sm font-medium text-brand-800">พนักงาน</span>
            <EmployeePicker name="employee" defaultValue={empId ?? undefined} options={emps.map((x) => ({ id: x.id, code: x.code, name: fullName(x), nickname: x.nickname }))} />
          </div>
          <Field label="แม่แบบสัญญา (ตามตำแหน่ง)">
            <Select name="template" placeholder="- เลือกแม่แบบ -" defaultValue={tplId ?? ""} options={templates.map((t) => ({ value: t.id, label: t.name }))} />
          </Field>
          <button className={btn.secondary}>ถัดไป</button>
        </form>
      </Card>

      {e && tpl && (
        <form action={createContract} className="space-y-5" key={`${e.id}-${tpl.id}`}>
          <input type="hidden" name="employeeId" value={e.id} />
          <input type="hidden" name="templateId" value={tpl.id} />

          {missing.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
              ข้อมูลพนักงานยังไม่ครบสำหรับสัญญา: <b>{missing.join(", ")}</b> — กรอกได้ที่{" "}
              <Link href={`/personnel/${e.id}`} className="font-medium underline underline-offset-4">
                หน้าพนักงาน
              </Link>{" "}
              (ถ้าออกสัญญาไปก่อน ช่องเหล่านี้จะเป็นเส้นว่างให้เขียนด้วยมือ)
            </div>
          )}

          <Card title={`2. รายละเอียดการจ้าง · ${fullName(e)} · แม่แบบ ${tpl.name}`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="วันที่ทำสัญญา">
                <Input name="contractDate" type="date" required defaultValue={bkkDateStr()} />
              </Field>
              <Field label="ลักษณะการจ้าง">
                <Select
                  name="kind"
                  defaultValue="permanent"
                  options={[
                    { value: "permanent", label: "พนักงานประจำ (มีทดลองงาน)" },
                    { value: "temporary", label: "พนักงานชั่วคราว" },
                  ]}
                />
              </Field>
              <Field label="วันเริ่มงาน">
                <Input name="startDate" type="date" required defaultValue={e.startDate} />
              </Field>
              <Field label="ทดลองงาน (วัน)" hint="พนักงานประจำ">
                <Input name="probationDays" type="number" min={0} max={365} defaultValue={tpl.probationDays} />
              </Field>
              <Field label="สิ้นสุดการจ้าง" hint="เฉพาะพนักงานชั่วคราว">
                <Input name="endDate" type="date" />
              </Field>
              <Field label="ตำแหน่ง">
                <Input name="position" defaultValue={picked?.pos ?? ""} />
              </Field>
              <Field label="ฝ่าย / แผนก">
                <Input name="department" defaultValue={picked?.dept ?? ""} />
              </Field>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            {[
              { key: "prob", title: "ค่าจ้างช่วงทดลองงาน", hint: "ใช้เฉพาะพนักงานประจำ", cond: "probationConditions" },
              { key: "reg", title: "ค่าจ้างเมื่อผ่านทดลองงาน (หรือค่าจ้างพนักงานชั่วคราว)", hint: "", cond: "regularConditions" },
            ].map((b) => (
              <Card key={b.key} title={b.title} subtitle={`หน่วย: บาท${tpl.payUnit}${b.hint ? ` · ${b.hint}` : ""}`}>
                <div className="space-y-2">
                  {[...labels, "", ""].map((label, i) => (
                    <div key={i} className="grid grid-cols-[1fr_140px] gap-2">
                      <Input name={`${b.key}Label`} defaultValue={label} placeholder={i >= labels.length ? "รายการเพิ่มเติม (ถ้ามี)" : undefined} />
                      <Input name={`${b.key}Amount`} inputMode="decimal" placeholder="0" defaultValue={defaultPay(i)} className="text-right" />
                    </div>
                  ))}
                </div>
                <Field label="เงื่อนไขข้อตกลงอื่น ๆ (บรรทัดละ 1 ข้อ)" className="mt-3">
                  <Textarea name={b.cond} rows={3} defaultValue={tpl.conditions} />
                </Field>
              </Card>
            ))}
          </div>

          <Card title="ผู้ลงนาม" subtitle="ระบบจำชื่อไว้ใช้ครั้งถัดไป">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="ผู้มีอำนาจลงนามแทนนายจ้าง">
                <Input name="employerRep" defaultValue={company.employerRepName ?? ""} placeholder="ชื่อ-นามสกุล" />
              </Field>
              <Field label="ตำแหน่งผู้ลงนาม">
                <Input name="employerRepTitle" defaultValue={company.employerRepTitle ?? ""} placeholder="เช่น ประธานกรรมการบริหาร" />
              </Field>
              <Field label="หัวหน้าฝ่ายบุคคล">
                <Input name="hrHead" defaultValue={company.hrHeadName ?? ""} />
              </Field>
              <Field label="พยาน" hint="เว้นว่าง = เขียนด้วยมือ">
                <Input name="witness" />
              </Field>
            </div>
          </Card>

          <SubmitButton>ออกสัญญาจ้าง</SubmitButton>
        </form>
      )}
    </>
  );
}
