import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { attendanceLogs, branches, employees, users } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Flash, Input, Select, Table, btn } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { addDays, atBkk, bkkDateStr, bkkTimeStr } from "@/lib/time";
import { fullName } from "@/lib/util";
import { addManualPunch, deletePunch } from "../actions";

export const metadata = { title: "บันทึกการสแกน" };

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ date?: string; employee?: string; ok?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : bkkDateStr();
  const [rows, emps] = await Promise.all([
    db
      .select({ l: attendanceLogs, e: employees, branch: branches.name, by: users.username })
      .from(attendanceLogs)
      .innerJoin(employees, eq(attendanceLogs.employeeId, employees.id))
      .leftJoin(branches, eq(attendanceLogs.branchId, branches.id))
      .leftJoin(users, eq(attendanceLogs.createdBy, users.id))
      .where(
        and(
          gte(attendanceLogs.punchedAt, atBkk(date)),
          lt(attendanceLogs.punchedAt, atBkk(addDays(date, 1))),
          sp.employee ? eq(attendanceLogs.employeeId, Number(sp.employee)) : undefined,
        ),
      )
      .orderBy(desc(attendanceLogs.punchedAt)),
    db.select().from(employees).where(ne(employees.status, "resigned")).orderBy(asc(employees.code)),
  ]);
  const empOptions = emps.map((e) => ({ value: e.id, label: `${e.code} ${fullName(e)}` }));
  const back = `/attendance/logs?date=${date}`;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div>
        <Flash ok={sp.ok} error={sp.error} />
        <form className="mb-4 flex flex-wrap gap-2">
          <Link href={`?date=${addDays(date, -1)}`} className={btn.secondary}>
            ‹
          </Link>
          <Input type="date" name="date" defaultValue={date} className="w-auto" />
          <Link href={`?date=${addDays(date, 1)}`} className={btn.secondary}>
            ›
          </Link>
          <Select name="employee" placeholder="ทุกคน" defaultValue={sp.employee ?? ""} options={empOptions} className="w-auto" />
          <button className={btn.secondary}>แสดง</button>
        </form>
        <Table head={["เวลา", "พนักงาน", "ประเภท", "วิธี", "สาขา / ระยะ", "GPS", "หมายเหตุ", ""]} empty={!rows.length}>
          {rows.map(({ l, e, branch, by }) => (
            <tr key={l.id}>
              <td className="tabular-nums">{bkkTimeStr(l.punchedAt)}</td>
              <td>
                {fullName(e)} <span className="text-xs text-stone-400">{e.code}</span>
              </td>
              <td>
                <Badge tone={l.type === "in" ? "green" : "red"}>{l.type === "in" ? "เข้า" : "ออก"}</Badge>
              </td>
              <td>
                {l.method === "biometric" ? (
                  <Badge tone="blue">ลายนิ้วมือ</Badge>
                ) : (
                  <Badge tone="amber">
                    {l.method === "manual" ? "HR บันทึก" : "แก้ไขเวลา"}
                    {by ? ` · ${by}` : ""}
                  </Badge>
                )}
              </td>
              <td>
                {branch ?? "-"}
                {l.distanceM != null && <span className="text-xs text-stone-400"> · {Math.round(l.distanceM)} ม.</span>}
              </td>
              <td className="text-xs">
                {l.latitude != null ? (
                  <a className="text-brand-600 underline" target="_blank" href={`https://maps.google.com/?q=${l.latitude},${l.longitude}`}>
                    แผนที่ (±{Math.round(l.accuracyM ?? 0)}ม.)
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td className="max-w-48 truncate text-xs text-stone-500" title={l.note ?? ""}>
                {l.note ?? ""}
              </td>
              <td>
                <form action={deletePunch}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton variant="ghost" confirm="ลบรายการลงเวลานี้?">
                    ลบ
                  </SubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <Card title="บันทึกเวลาแทนพนักงาน">
        <form action={addManualPunch} className="space-y-3">
          <Field label="พนักงาน">
            <Select name="employeeId" required placeholder="- เลือก -" options={empOptions} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="ประเภท">
              <Select
                name="type"
                options={[
                  { value: "in", label: "เข้า" },
                  { value: "out", label: "ออก" },
                ]}
              />
            </Field>
            <Field label="วันที่" className="col-span-2">
              <Input type="date" name="date" required defaultValue={date} />
            </Field>
          </div>
          <Field label="เวลา">
            <Input type="time" name="time" required />
          </Field>
          <Field label="เหตุผล">
            <Input name="note" required placeholder="เช่น มือถือพนักงานเสีย" />
          </Field>
          <SubmitButton>บันทึก</SubmitButton>
          <p className="text-xs text-stone-400">การบันทึกแทนจะถูกเก็บประวัติว่าใครเป็นผู้บันทึก ควรใช้ “ขอแก้ไขเวลา” ใน Approve Center เป็นหลัก</p>
        </form>
      </Card>
    </div>
  );
}
