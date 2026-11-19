import { asc, count, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches, employees } from "@/db/schema";
import { GpsFillButton } from "@/components/gps-fill-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Checkbox, Field, Flash, Input, Table, btn } from "@/components/ui";
import { deleteBranch, saveBranch } from "../actions";

export const metadata = { title: "สาขา" };

export default async function BranchesPage({ searchParams }: { searchParams: Promise<{ edit?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const rows = await db
    .select({ b: branches, n: count(employees.id) })
    .from(branches)
    .leftJoin(employees, eq(employees.branchId, branches.id))
    .groupBy(branches.id)
    .orderBy(asc(branches.code));
  const edit = rows.find((r) => r.b.id === Number(sp.edit))?.b;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div>
        <Flash ok={sp.ok} error={sp.error} />
        <Table head={["รหัส", "ชื่อสาขา", "พิกัด", "รัศมี", "พนักงาน", "สถานะ", ""]} empty={!rows.length}>
          {rows.map(({ b, n }) => (
            <tr key={b.id}>
              <td className="font-medium">{b.code}</td>
              <td>
                {b.name}
                {b.address && <div className="text-xs text-stone-400">{b.address}</div>}
              </td>
              <td>
                {b.latitude != null ? (
                  <a className="text-brand-600 underline" target="_blank" href={`https://maps.google.com/?q=${b.latitude},${b.longitude}`}>
                    {b.latitude.toFixed(5)}, {b.longitude?.toFixed(5)}
                  </a>
                ) : (
                  <Badge tone="amber">ยังไม่ตั้งพิกัด</Badge>
                )}
              </td>
              <td>{b.radiusM} ม.</td>
              <td>{n}</td>
              <td>{b.active ? <Badge tone="green">ใช้งาน</Badge> : <Badge>ปิด</Badge>}</td>
              <td className="text-right whitespace-nowrap">
                <Link href={`?edit=${b.id}`} className={btn.ghost}>
                  แก้ไข
                </Link>
                <form action={deleteBranch} className="inline">
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton variant="ghost" confirm={`ลบสาขา ${b.name}?`}>
                    ลบ
                  </SubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-xs text-stone-500">
          พนักงานจะสแกนนิ้วลงเวลาได้เมื่ออยู่ในรัศมีของสาขาที่เปิดใช้งาน (ยกเว้นพนักงานที่อนุญาตให้ลงเวลานอกสถานที่)
        </p>
      </div>

      <Card title={edit ? `แก้ไขสาขา ${edit.code}` : "เพิ่มสาขา"} actions={edit && <Link href="?" className="text-sm text-stone-500">ยกเลิก</Link>}>
        <form action={saveBranch} className="space-y-3" key={edit?.id ?? "new"}>
          {edit && <input type="hidden" name="id" value={edit.id} />}
          <div className="grid grid-cols-3 gap-3">
            <Field label="รหัส">
              <Input name="code" required defaultValue={edit?.code} />
            </Field>
            <Field label="ชื่อสาขา" className="col-span-2">
              <Input name="name" required defaultValue={edit?.name} />
            </Field>
          </div>
          <Field label="ที่อยู่">
            <Input name="address" defaultValue={edit?.address ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <Input id="lat" name="latitude" inputMode="decimal" defaultValue={edit?.latitude ?? ""} />
            </Field>
            <Field label="Longitude">
              <Input id="lng" name="longitude" inputMode="decimal" defaultValue={edit?.longitude ?? ""} />
            </Field>
          </div>
          <GpsFillButton latId="lat" lngId="lng" />
          <Field label="รัศมีที่อนุญาตให้ลงเวลา (เมตร)" hint="แนะนำ 100–300 ม. เผื่อ GPS คลาดเคลื่อนในอาคาร">
            <Input name="radiusM" type="number" min={20} max={5000} defaultValue={edit?.radiusM ?? 150} />
          </Field>
          <Checkbox name="active" label="เปิดใช้งาน" defaultChecked={edit?.active ?? true} />
          <div>
            <SubmitButton>บันทึก</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
