import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { attendanceLogs, branches, employees, users } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { DateRangeNav, FilterBar, FilterSelect } from "@/components/filter-bar";
import { Badge, Card, Field, Flash, Input, Select, Table, btn } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { parseRange } from "@/lib/range";
import { addDays, atBkk, bkkTimeStr, fmtDate } from "@/lib/time";
import { fullName } from "@/lib/util";
import { addManualPunch, deletePunch } from "../actions";

export const metadata = { title: "บันทึกการสแกน" };

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ date?: string; from?: string; to?: string; employee?: string; ok?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const r = parseRange(sp, 62);
  const date = r.to; // ค่าเริ่มต้นของฟอร์ม "HR บันทึกเวลาแทน"
  const [rows, emps] = await Promise.all([
    db
      .select({ l: attendanceLogs, e: employees, branch: branches.name, by: users.username })
      .from(attendanceLogs)
      .innerJoin(employees, eq(attendanceLogs.employeeId, employees.id))
      .leftJoin(branches, eq(attendanceLogs.branchId, branches.id))
      .leftJoin(users, eq(attendanceLogs.createdBy, users.id))
      .where(
        and(
          gte(attendanceLogs.punchedAt, atBkk(r.from)),
          lt(attendanceLogs.punchedAt, atBkk(addDays(r.to, 1))),
          sp.employee ? eq(attendanceLogs.employeeId, Number(sp.employee)) : undefined,
        ),
      )
      .orderBy(desc(attendanceLogs.punchedAt)),
    db.select().from(employees).where(ne(employees.status, "resigned")).orderBy(asc(employees.code)),
  ]);
  const empOptions = emps.map((e) => ({ value: e.id, label: `${e.code} ${fullName(e)}` }));
  const back = r.single ? `/attendance/logs?date=${r.from}` : `/attendance/logs?from=${r.from}&to=${r.to}`;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div>
        <Flash ok={sp.ok} error={sp.error} />
        <FilterBar>
          <DateRangeNav
            from={r.from}
            to={r.to}
            today={r.today}
            prev={r.prev}
            next={r.next}
            label={r.label}
            maxDays={62}
            sublabel={r.single ? (r.from === r.today ? "วันนี้" : undefined) : `${r.days} วัน`}
          />
          <FilterSelect param="employee" value={sp.employee ?? ""} placeholder="พนักงานทุกคน" options={empOptions} className="min-w-52 flex-1 sm:flex-none" />
          <span className="ml-auto hidden px-3 text-sm text-stone-500 md:inline">{rows.length} รายการ</span>
        </FilterBar>
        {/* 8 ค่าเดิม รวมเหลือ 5 คอลัมน์ให้พอดีกรอบ (ไม่ต้องเลื่อนซ้าย-ขวา) */}
        <Table head={["เวลา", "พนักงาน", "ประเภท", "สถานที่", ""]} empty={!rows.length}>
          {rows.map(({ l, e, branch, by }) => (
            <tr key={l.id}>
              <td>
                <span className="block text-base font-semibold text-brand-900 tabular-nums">{bkkTimeStr(l.punchedAt)}</span>
                {!r.single && <span className="block text-xs font-normal text-stone-500">{fmtDate(l.punchedAt)}</span>}
              </td>
              <td>
                <span className="block">{fullName(e)}</span>
                <span className="block text-xs text-stone-400">{e.code}</span>
              </td>
              <td>
                <span className="flex flex-wrap justify-end gap-1 md:justify-start">
                  <Badge tone={l.type === "in" ? "green" : "red"}>{l.type === "in" ? "เข้า" : "ออก"}</Badge>
                  {l.method === "biometric" ? (
                    <Badge tone="blue">ลายนิ้วมือ</Badge>
                  ) : (
                    <Badge tone="amber">
                      {l.method === "manual" ? "HR บันทึก" : "แก้ไขเวลา"}
                      {by ? ` · ${by}` : ""}
                    </Badge>
                  )}
                </span>
              </td>
              <td>
                <span className="block">
                  {branch ?? <span className="text-amber-700">นอกสาขา</span>}
                  {l.distanceM != null && <span className="text-xs text-stone-400"> · {Math.round(l.distanceM)} ม.</span>}
                </span>
                <span className="block text-xs text-stone-500">
                  {l.latitude != null && (
                    <a className="text-brand-600 underline underline-offset-2" target="_blank" href={`https://maps.google.com/?q=${l.latitude},${l.longitude}`}>
                      ดูแผนที่ ±{Math.round(l.accuracyM ?? 0)} ม.
                    </a>
                  )}
                  {l.note && <span className="ml-1.5">{l.note}</span>}
                </span>
              </td>
              <td className="text-right">
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
