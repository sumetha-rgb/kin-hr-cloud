import { asc, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { departments, employees, positions } from "@/db/schema";
import { EmployeePicker } from "@/components/employee-picker";
import { SubmitButton } from "@/components/submit-button";
import { fullName } from "@/lib/util";
import { Card, Field, Flash, Input, Select, Table, btn } from "@/components/ui";
import { deleteDepartment, deletePosition, saveDepartment, savePosition } from "../actions";

export const metadata = { title: "แผนกและตำแหน่ง" };

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; pos?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const [depts, pos, emps] = await Promise.all([
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select().from(positions).orderBy(asc(positions.name)),
    db.select().from(employees).where(ne(employees.status, "resigned")).orderBy(asc(employees.code)),
  ]);
  const deptName = new Map(depts.map((d) => [d.id, d.name]));
  const empName = new Map(emps.map((e) => [e.id, fullName(e)]));
  const memberCount = new Map<number, number>();
  for (const e of emps) if (e.departmentId) memberCount.set(e.departmentId, (memberCount.get(e.departmentId) ?? 0) + 1);
  const editDept = depts.find((d) => d.id === Number(sp.dept));
  const editPos = pos.find((p) => p.id === Number(sp.pos));
  const deptOptions = depts.map((d) => ({ value: d.id, label: d.name }));

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="แผนก" subtitle="หัวหน้าแผนกอนุมัติคำขอของคนในแผนกเป็นขั้นแรก: ลา/แก้เวลา → ส่งต่อ HR · OT → จบที่หัวหน้า">
          <form action={saveDepartment} className="mb-4 grid gap-3 sm:grid-cols-2" key={editDept?.id ?? "new"}>
            {editDept && <input type="hidden" name="id" value={editDept.id} />}
            <Field label={editDept ? "แก้ไขชื่อแผนก" : "ชื่อแผนกใหม่"}>
              <Input name="name" required defaultValue={editDept?.name} />
            </Field>
            <Field label="สังกัดแผนก">
              <Select name="parentId" placeholder="- ไม่มี -" options={deptOptions} defaultValue={editDept?.parentId ?? ""} />
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-brand-800">หัวหน้าแผนก (ผู้อนุมัติขั้นแรก)</span>
              <EmployeePicker
                name="headEmployeeId"
                allowClear="ไม่มี (ส่งตรงถึง HR)"
                defaultValue={editDept?.headEmployeeId ?? undefined}
                options={emps.map((e) => ({ id: e.id, code: e.code, name: fullName(e), nickname: e.nickname, sub: e.departmentId ? deptName.get(e.departmentId) : null }))}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <SubmitButton>{editDept ? "บันทึก" : "เพิ่มแผนก"}</SubmitButton>
              {editDept && (
                <Link href="?" className="text-sm text-stone-500 hover:text-brand-800">
                  ยกเลิก
                </Link>
              )}
            </div>
          </form>
          <Table head={["แผนก", "หัวหน้าแผนก", ""]} empty={!depts.length}>
            {depts.map((d) => (
              <tr key={d.id} data-href={`/organization/departments?dept=${d.id}`}>
                <td>
                  <span className="block font-medium text-brand-900">{d.name}</span>
                  <span className="block text-xs text-stone-500">
                    {memberCount.get(d.id) ?? 0} คน{d.parentId ? ` · สังกัด ${deptName.get(d.parentId)}` : ""}
                  </span>
                </td>
                <td className={d.headEmployeeId ? "text-brand-900" : "text-xs text-amber-700"}>{d.headEmployeeId ? empName.get(d.headEmployeeId) : "ยังไม่ตั้ง (ส่งตรงถึง HR)"}</td>
                <td className="text-right whitespace-nowrap">
                  <Link href={`?dept=${d.id}`} className={btn.ghost}>
                    แก้ไข
                  </Link>
                  <form action={deleteDepartment} className="inline">
                    <input type="hidden" name="id" value={d.id} />
                    <SubmitButton variant="ghost" confirm={`ลบแผนก ${d.name}?`}>
                      ลบ
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="ตำแหน่ง">
          <form action={savePosition} className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" key={editPos?.id ?? "new"}>
            {editPos && <input type="hidden" name="id" value={editPos.id} />}
            <Field label={editPos ? "แก้ไขชื่อตำแหน่ง" : "ชื่อตำแหน่งใหม่"}>
              <Input name="name" required defaultValue={editPos?.name} />
            </Field>
            <Field label="แผนก">
              <Select name="departmentId" placeholder="- ไม่ระบุ -" options={deptOptions} defaultValue={editPos?.departmentId ?? ""} />
            </Field>
            <SubmitButton>{editPos ? "บันทึก" : "เพิ่ม"}</SubmitButton>
          </form>
          <Table head={["ตำแหน่ง", "แผนก", ""]} empty={!pos.length}>
            {pos.map((p) => (
              <tr key={p.id} data-href={`/organization/departments?pos=${p.id}`}>
                <td>{p.name}</td>
                <td className="text-stone-500">{p.departmentId ? deptName.get(p.departmentId) : "-"}</td>
                <td className="text-right whitespace-nowrap">
                  <Link href={`?pos=${p.id}`} className={btn.ghost}>
                    แก้ไข
                  </Link>
                  <form action={deletePosition} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <SubmitButton variant="ghost" confirm={`ลบตำแหน่ง ${p.name}?`}>
                      ลบ
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
