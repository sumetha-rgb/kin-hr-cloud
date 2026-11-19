import { asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Flash, Input, Table, btn } from "@/components/ui";
import { WEEKDAY_TH } from "@/lib/time";
import { deleteShift, saveShift } from "../actions";

export const metadata = { title: "กะการทำงาน" };

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ edit?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const rows = await db.select().from(shifts).orderBy(asc(shifts.startTime));
  const edit = rows.find((r) => r.id === Number(sp.edit));
  const editDays = new Set((edit?.workDays ?? "1,2,3,4,5").split(","));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div>
        <Flash ok={sp.ok} error={sp.error} />
        <Table head={["ชื่อกะ", "เวลา", "พัก", "สายได้", "วันทำงาน", ""]} empty={!rows.length}>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="font-medium">{s.name}</td>
              <td>
                {s.startTime} – {s.endTime} {s.endTime <= s.startTime && <Badge tone="amber">ข้ามวัน</Badge>}
              </td>
              <td>{s.breakMinutes} นาที</td>
              <td>{s.lateGraceMinutes} นาที</td>
              <td className="text-xs">
                {s.workDays
                  .split(",")
                  .map((d) => WEEKDAY_TH[Number(d)])
                  .join(" ")}
              </td>
              <td className="text-right whitespace-nowrap">
                <Link href={`?edit=${s.id}`} className={btn.ghost}>
                  แก้ไข
                </Link>
                <form action={deleteShift} className="inline">
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton variant="ghost" confirm={`ลบกะ ${s.name}?`}>
                    ลบ
                  </SubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <Card title={edit ? "แก้ไขกะ" : "เพิ่มกะ"} actions={edit && <Link href="?" className="text-sm text-stone-500">ยกเลิก</Link>}>
        <form action={saveShift} className="space-y-3" key={edit?.id ?? "new"}>
          {edit && <input type="hidden" name="id" value={edit.id} />}
          <Field label="ชื่อกะ">
            <Input name="name" required defaultValue={edit?.name} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="เวลาเข้า">
              <Input name="startTime" type="time" required defaultValue={edit?.startTime ?? "08:00"} />
            </Field>
            <Field label="เวลาออก" hint="น้อยกว่าเวลาเข้า = กะข้ามวัน">
              <Input name="endTime" type="time" required defaultValue={edit?.endTime ?? "17:00"} />
            </Field>
            <Field label="พัก (นาที)">
              <Input name="breakMinutes" type="number" min={0} defaultValue={edit?.breakMinutes ?? 60} />
            </Field>
            <Field label="อนุโลมสาย (นาที)">
              <Input name="lateGraceMinutes" type="number" min={0} defaultValue={edit?.lateGraceMinutes ?? 0} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-stone-700">วันทำงาน</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <label key={d} className="flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-sm">
                  <input type="checkbox" name="workDays" value={d} defaultChecked={editDays.has(String(d))} className="accent-brand-600" />
                  {WEEKDAY_TH[d]}
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton>บันทึก</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
