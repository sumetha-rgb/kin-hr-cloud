import { asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { leaveTypes } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Checkbox, Field, Flash, Input, Table, btn } from "@/components/ui";
import { deleteLeaveType, saveLeaveType } from "../actions";

export const metadata = { title: "ประเภทการลา" };

export default async function LeaveTypesPage({ searchParams }: { searchParams: Promise<{ edit?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const rows = await db.select().from(leaveTypes).orderBy(asc(leaveTypes.id));
  const edit = rows.find((r) => r.id === Number(sp.edit));
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div>
        <Flash ok={sp.ok} error={sp.error} />
        <Table head={["รหัส", "ประเภท", "สิทธิ์/ปี", "ค่าจ้าง", ""]} empty={!rows.length}>
          {rows.map((l) => (
            <tr key={l.id}>
              <td className="font-medium">{l.code}</td>
              <td>{l.name}</td>
              <td>{l.daysPerYear ? `${l.daysPerYear} วัน` : "ไม่จำกัด"}</td>
              <td>{l.paid ? <Badge tone="green">ได้รับค่าจ้าง</Badge> : <Badge tone="amber">ไม่ได้รับ</Badge>}</td>
              <td className="text-right whitespace-nowrap">
                <Link href={`?edit=${l.id}`} className={btn.ghost}>
                  แก้ไข
                </Link>
                <form action={deleteLeaveType} className="inline">
                  <input type="hidden" name="id" value={l.id} />
                  <SubmitButton variant="ghost" confirm={`ลบ ${l.name}?`}>
                    ลบ
                  </SubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <Card title={edit ? "แก้ไขประเภทการลา" : "เพิ่มประเภทการลา"}>
        <form action={saveLeaveType} className="space-y-3" key={edit?.id ?? "new"}>
          {edit && <input type="hidden" name="id" value={edit.id} />}
          <div className="grid grid-cols-3 gap-3">
            <Field label="รหัส">
              <Input name="code" required defaultValue={edit?.code} />
            </Field>
            <Field label="ชื่อ" className="col-span-2">
              <Input name="name" required defaultValue={edit?.name} />
            </Field>
          </div>
          <Field label="สิทธิ์ต่อปี (วัน)" hint="0 = ไม่จำกัด">
            <Input name="daysPerYear" type="number" min={0} defaultValue={edit?.daysPerYear ?? 0} />
          </Field>
          <Checkbox name="paid" label="ได้รับค่าจ้างระหว่างลา" defaultChecked={edit?.paid ?? true} />
          <div>
            <SubmitButton>บันทึก</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
