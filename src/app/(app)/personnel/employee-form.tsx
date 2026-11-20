import { asc, ne } from "drizzle-orm";
import { db } from "@/db";
import { branches, departments, employees, positions, shifts, type Employee } from "@/db/schema";
import { EmployeePicker } from "@/components/employee-picker";
import { SubmitButton } from "@/components/submit-button";
import { Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { bkkDateStr } from "@/lib/time";
import { fullName, STATUS_LABEL } from "@/lib/util";
import { saveEmployee } from "./actions";

export async function EmployeeForm({ employee: e, suggestedCode }: { employee?: Employee; suggestedCode?: string }) {
  const [br, dp, ps, sh, mgr] = await Promise.all([
    db.select().from(branches).orderBy(asc(branches.code)),
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select().from(positions).orderBy(asc(positions.name)),
    db.select().from(shifts).orderBy(asc(shifts.startTime)),
    db.select().from(employees).where(ne(employees.status, "resigned")).orderBy(asc(employees.firstName)),
  ]);

  return (
    <form action={saveEmployee} className="space-y-5">
      {e && <input type="hidden" name="id" value={e.id} />}
      <Card title="ข้อมูลส่วนตัว">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="รหัสพนักงาน">
            <Input name="code" required defaultValue={e?.code ?? suggestedCode} />
          </Field>
          <Field label="คำนำหน้า">
            <Select name="prefix" placeholder="-" defaultValue={e?.prefix ?? ""} options={["นาย", "นาง", "นางสาว"].map((x) => ({ value: x, label: x }))} />
          </Field>
          <Field label="ชื่อ">
            <Input name="firstName" required defaultValue={e?.firstName} />
          </Field>
          <Field label="นามสกุล">
            <Input name="lastName" required defaultValue={e?.lastName} />
          </Field>
          <Field label="ชื่อเล่น">
            <Input name="nickname" defaultValue={e?.nickname ?? ""} />
          </Field>
          <Field label="เลขบัตรประชาชน">
            <Input name="nationalId" inputMode="numeric" maxLength={13} defaultValue={e?.nationalId ?? ""} />
          </Field>
          <Field label="วันเกิด">
            <Input name="birthDate" type="date" defaultValue={e?.birthDate ?? ""} />
          </Field>
          <Field label="เบอร์โทร">
            <Input name="phone" type="tel" defaultValue={e?.phone ?? ""} />
          </Field>
          <Field label="อีเมล" className="sm:col-span-2">
            <Input name="email" type="email" defaultValue={e?.email ?? ""} />
          </Field>
          <Field label="LINE ID">
            <Input name="lineId" autoCapitalize="none" defaultValue={e?.lineId ?? ""} />
          </Field>
          <Field label="ผู้ติดต่อฉุกเฉิน">
            <Input name="emergencyName" placeholder="ชื่อ (ความสัมพันธ์)" defaultValue={e?.emergencyName ?? ""} />
          </Field>
          <Field label="เบอร์ผู้ติดต่อฉุกเฉิน">
            <Input name="emergencyPhone" type="tel" defaultValue={e?.emergencyPhone ?? ""} />
          </Field>
          <Field label="ที่อยู่ปัจจุบัน" className="sm:col-span-2 lg:col-span-4">
            <Textarea name="address" rows={2} defaultValue={e?.address ?? ""} />
          </Field>
          <Field label="แนะนำตัว" hint="แสดงบนโปรไฟล์ของพนักงาน" className="sm:col-span-2 lg:col-span-4">
            <Textarea name="bio" rows={2} maxLength={300} defaultValue={e?.bio ?? ""} />
          </Field>
        </div>
      </Card>

      <Card title="การจ้างงาน">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="วันเริ่มงาน">
            <Input name="startDate" type="date" required defaultValue={e?.startDate ?? bkkDateStr()} />
          </Field>
          <Field label="สถานะ">
            <Select name="status" defaultValue={e?.status ?? "probation"} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="วันที่พ้นสภาพ" hint="กรอกเมื่อลาออก">
            <Input name="endDate" type="date" defaultValue={e?.endDate ?? ""} />
          </Field>
          <Field label="สาขา">
            <Select name="branchId" placeholder="- เลือก -" defaultValue={e?.branchId ?? ""} options={br.map((b) => ({ value: b.id, label: `${b.code} ${b.name}` }))} />
          </Field>
          <Field label="แผนก">
            <Select name="departmentId" placeholder="- เลือก -" defaultValue={e?.departmentId ?? ""} options={dp.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
          <Field label="ตำแหน่ง">
            <Select name="positionId" placeholder="- เลือก -" defaultValue={e?.positionId ?? ""} options={ps.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label="กะการทำงาน">
            <Select name="shiftId" placeholder="- ค่าเริ่มต้น 08:00-17:00 -" defaultValue={e?.shiftId ?? ""} options={sh.map((s) => ({ value: s.id, label: s.name }))} />
          </Field>
          <div>
            <span className="mb-1 block text-sm font-medium text-brand-800">หัวหน้างานเฉพาะคน</span>
            <EmployeePicker
              name="managerId"
              allowClear="ใช้หัวหน้าแผนก"
              defaultValue={e?.managerId ?? undefined}
              options={mgr.filter((m) => m.id !== e?.id).map((m) => ({ id: m.id, code: m.code, name: fullName(m), nickname: m.nickname }))}
            />
            <span className="mt-1 block text-xs text-stone-500">เว้นว่างไว้ = ให้หัวหน้าแผนกอนุมัติ · ตั้งไว้เมื่อคนนี้ต้องให้คนอื่นอนุมัติแทน</span>
          </div>
        </div>
        <div className="mt-3">
          <Checkbox name="allowRemoteCheckin" label="อนุญาตให้สแกนนิ้วลงเวลานอกสถานที่ (ไม่ต้องอยู่ในรัศมีสาขา เช่น งานภาคสนาม)" defaultChecked={e?.allowRemoteCheckin ?? false} />
        </div>
      </Card>

      <Card title="เงินเดือนและภาษี">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="ประเภทการจ่าย">
            <Select
              name="payType"
              defaultValue={e?.payType ?? "monthly"}
              options={[
                { value: "monthly", label: "รายเดือน" },
                { value: "daily", label: "รายวัน" },
              ]}
            />
          </Field>
          <Field label="เงินเดือน / ค่าแรงต่อวัน (บาท)">
            <Input name="baseSalary" type="number" step="0.01" min={0} defaultValue={e?.baseSalary ?? "0"} />
          </Field>
          <Field label="เงินเพิ่มประจำ/เดือน" hint="เช่น ค่าตำแหน่ง ค่าเดินทาง">
            <Input name="monthlyAllowance" type="number" step="0.01" min={0} defaultValue={e?.monthlyAllowance ?? "0"} />
          </Field>
          <Field label="ค่าลดหย่อนภาษีเพิ่มเติม/ปี" hint="นอกจากส่วนตัว 60,000 และประกันสังคม">
            <Input name="extraTaxAllowance" type="number" step="0.01" min={0} defaultValue={e?.extraTaxAllowance ?? "0"} />
          </Field>
          <Field label="ธนาคาร">
            <Input name="bankName" defaultValue={e?.bankName ?? ""} />
          </Field>
          <Field label="เลขบัญชี">
            <Input name="bankAccount" inputMode="numeric" defaultValue={e?.bankAccount ?? ""} />
          </Field>
        </div>
        <div className="mt-3">
          <Checkbox name="ssoEnabled" label="หักเงินประกันสังคม" defaultChecked={e?.ssoEnabled ?? true} />
        </div>
      </Card>
      <SubmitButton>บันทึกข้อมูลพนักงาน</SubmitButton>
    </form>
  );
}
