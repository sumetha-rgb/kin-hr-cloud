import { asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { departments, positions } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, Flash, Input, Select, Table, btn } from "@/components/ui";
import { deleteDepartment, deletePosition, saveDepartment, savePosition } from "../actions";

export const metadata = { title: "แผนกและตำแหน่ง" };

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; pos?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const [depts, pos] = await Promise.all([
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select().from(positions).orderBy(asc(positions.name)),
  ]);
  const deptName = new Map(depts.map((d) => [d.id, d.name]));
  const editDept = depts.find((d) => d.id === Number(sp.dept));
  const editPos = pos.find((p) => p.id === Number(sp.pos));
  const deptOptions = depts.map((d) => ({ value: d.id, label: d.name }));

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="แผนก">
          <form action={saveDepartment} className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" key={editDept?.id ?? "new"}>
            {editDept && <input type="hidden" name="id" value={editDept.id} />}
            <Field label={editDept ? "แก้ไขชื่อแผนก" : "ชื่อแผนกใหม่"}>
              <Input name="name" required defaultValue={editDept?.name} />
            </Field>
            <Field label="สังกัดแผนก">
              <Select name="parentId" placeholder="- ไม่มี -" options={deptOptions} defaultValue={editDept?.parentId ?? ""} />
            </Field>
            <SubmitButton>{editDept ? "บันทึก" : "เพิ่ม"}</SubmitButton>
          </form>
          <Table head={["แผนก", "สังกัด", ""]} empty={!depts.length}>
            {depts.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td className="text-stone-500">{d.parentId ? deptName.get(d.parentId) : "-"}</td>
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
              <tr key={p.id}>
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
