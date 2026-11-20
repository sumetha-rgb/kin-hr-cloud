import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { departments, employees, holidays, shiftSwaps, shifts } from "@/db/schema";
import { FilterBar, FilterSelect, StepNav } from "@/components/filter-bar";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Flash, Input, PageHeader } from "@/components/ui";
import { approversOf, teamOf } from "@/lib/approval";
import { isHR, requireUser } from "@/lib/auth";
import { loadRoster, shiftShort, shiftTone } from "@/lib/roster";
import { addDays, bkkDateStr, eachDate, fmtDate, isoWeekday, WEEKDAY_TH } from "@/lib/time";
import { cn, fullName } from "@/lib/util";
import { decideSwap, saveRoster } from "./actions";
import { isWorkDay } from "@/lib/attendance";

export const metadata = { title: "ตารางเวร" };

const DAYS = 14;

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ from?: string; dept?: string; ok?: string; error?: string }> }) {
  const u = await requireUser();
  if (u.role === "employee") redirect("/roster/me");
  const sp = await searchParams;
  const hr = isHR(u);
  const today = bkkDateStr();
  // เริ่มวันจันทร์ของสัปดาห์ที่เลือก
  const base = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : today;
  const start = addDays(base, -(isoWeekday(base) - 1));
  const end = addDays(start, DAYS - 1);
  const dates = eachDate(start, end);
  const deptId = Number(sp.dept) || null;

  const team = hr ? null : u.employeeId ? await teamOf(u.employeeId) : [];
  const [emps, allShifts, hol, depts] = await Promise.all([
    db
      .select({ e: employees, dept: departments.name })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(
        and(
          ne(employees.status, "resigned"),
          team ? inArray(employees.id, team.length ? team : [-1]) : undefined,
          deptId ? eq(employees.departmentId, deptId) : undefined,
        ),
      )
      .orderBy(asc(employees.departmentId), asc(employees.code)),
    db.select().from(shifts).orderBy(asc(shifts.startTime)),
    db.select().from(holidays),
    hr ? db.select().from(departments).orderBy(asc(departments.name)) : Promise.resolve([]),
  ]);
  const roster = await loadRoster(
    start,
    end,
    emps.map((x) => x.e.id),
  );
  const byId = new Map(allShifts.map((s) => [s.id, s]));
  const holiday = new Map(hol.map((h) => [h.date, h.name]));

  // คำขอแลกเวรที่รอ "คุณ" อนุมัติ
  const req = alias(employees, "req");
  const par = alias(employees, "par");
  const swaps = await db
    .select({ s: shiftSwaps, req, par })
    .from(shiftSwaps)
    .innerJoin(req, eq(shiftSwaps.requesterId, req.id))
    .innerJoin(par, eq(shiftSwaps.partnerId, par.id))
    .where(eq(shiftSwaps.status, "pending_head"));
  const mySwaps = [];
  for (const x of swaps) {
    const { headId, actingId } = await approversOf(x.s.requesterId);
    if (headId ? u.employeeId === headId || u.employeeId === actingId : hr) mySwaps.push(x);
  }

  const q = (from: string) => `?from=${from}${deptId ? `&dept=${deptId}` : ""}`;
  const cellOf = (e: (typeof emps)[number]["e"], d: string) => {
    const r = roster.get(e.id);
    const assigned = r?.has(d);
    const regular = e.shiftId ? byId.get(e.shiftId) : undefined;
    const sid = assigned ? (r!.get(d) ?? null) : regular && isWorkDay(d, regular) ? regular.id : null;
    return { assigned, value: assigned ? (r!.get(d) === null ? "off" : String(r!.get(d))) : "", shift: sid ? byId.get(sid) : null, regular };
  };

  return (
    <>
      <PageHeader title="ตารางเวร" subtitle="จัดเวรรายวันแทนกะประจำ · ช่องที่ไม่ได้เลือก = ตามกะประจำ · พนักงานแลกเวรกันเองได้ หัวหน้าอนุมัติ" />
      <Flash ok={sp.ok} error={sp.error} />

      {mySwaps.length > 0 && (
        <section className="mb-5 space-y-3">
          <h2 className="text-lg font-semibold text-brand-900">คำขอแลกเวรรอคุณอนุมัติ {mySwaps.length} รายการ</h2>
          {mySwaps.map(({ s, req: a, par: b }) => (
            <div key={s.id} className="rounded-3xl border border-brand-200/80 bg-white p-4 shadow-card">
              <p className="font-medium text-brand-900">
                {fullName(a)} ↔ {fullName(b)}
              </p>
              <p className="text-sm text-stone-600">
                {s.requesterDate === s.partnerDate
                  ? `สลับกะกันวันที่ ${fmtDate(s.requesterDate)}`
                  : `${b.firstName} ทำแทน ${a.firstName} วันที่ ${fmtDate(s.requesterDate)} · ${a.firstName} ทำแทน ${b.firstName} วันที่ ${fmtDate(s.partnerDate)}`}
                {s.reason ? ` · เหตุผล: ${s.reason}` : ""}
              </p>
              <form action={decideSwap} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={s.id} />
                <Input name="note" placeholder="หมายเหตุ (ถ้ามี)" className="max-w-xs min-w-48 flex-1" />
                <SubmitButton name="decision" value="approved" variant="success">
                  อนุมัติ
                </SubmitButton>
                <SubmitButton name="decision" value="rejected" variant="secondary" confirm="ยืนยันไม่อนุมัติ?">
                  ไม่อนุมัติ
                </SubmitButton>
              </form>
            </div>
          ))}
        </section>
      )}

      <FilterBar>
        <StepNav prev={q(addDays(start, -DAYS))} next={q(addDays(start, DAYS))} label={`${fmtDate(start)} – ${fmtDate(end)}`} />
        {hr && (
          <FilterSelect
            param="dept"
            value={sp.dept ?? ""}
            label="แผนก"
            placeholder="ทุกแผนก"
            options={depts.map((d) => ({ value: d.id, label: d.name }))}
            className="min-w-44"
          />
        )}
        <span className="ml-auto hidden flex-wrap items-center gap-2 px-2 text-xs lg:flex">
          {allShifts.map((s) => (
            <span key={s.id} className={cn("rounded-md px-1.5 py-0.5", shiftTone(s))} title={s.name}>
              {shiftShort(s)}
            </span>
          ))}
          <span className={cn("rounded-md px-1.5 py-0.5", shiftTone(null))}>หยุด</span>
        </span>
      </FilterBar>

      {/* key ใหม่ทุกครั้งที่โหลด: ให้ช่องเลือกแสดงค่าล่าสุดหลังอนุมัติแลกเวร/บันทึก (ไม่ค้างค่าเดิมในฟอร์ม) */}
      <form action={saveRoster} key={`${start}-${Date.now()}`}>
        <input type="hidden" name="start" value={start} />
        <input type="hidden" name="end" value={end} />
        <input type="hidden" name="back" value={`/roster${q(start)}`} />
        <div className="overflow-x-auto rounded-3xl border border-brand-200/80 bg-white shadow-card">
          <table className="w-full min-w-[860px] table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-40" />
              {dates.map((d) => (
                <col key={d} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-brand-50/60 text-brand-700">
                <th className="px-3 py-2 text-left font-medium">พนักงาน</th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className={cn("px-0.5 py-1.5 text-center font-medium", (isoWeekday(d) >= 6 || holiday.has(d)) && "text-rose-600", d === today && "bg-brand-100")}
                    title={holiday.get(d)}
                  >
                    <span className="block text-[10px]">{WEEKDAY_TH[isoWeekday(d)]}</span>
                    {Number(d.slice(8))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emps.map(({ e, dept }) => (
                <tr key={e.id} className="border-t border-brand-100">
                  <td className="truncate px-3 py-1.5">
                    <input type="hidden" name="emp" value={e.id} />
                    <span className="block truncate font-medium text-brand-900">{e.nickname ? `${e.firstName} (${e.nickname})` : `${e.firstName} ${e.lastName}`}</span>
                    <span className="block truncate text-[10px] text-stone-500">{dept ?? "-"}</span>
                  </td>
                  {dates.map((d) => {
                    const c = cellOf(e, d);
                    return (
                      <td key={d} className="p-0.5">
                        <select
                          name={`c_${e.id}_${d}`}
                          defaultValue={c.value}
                          title={c.shift?.name ?? "หยุด"}
                          className={cn(
                            "w-full cursor-pointer appearance-none rounded-md py-1 text-center text-[11px] font-medium",
                            shiftTone(c.shift),
                            c.assigned && "ring-1 ring-brand-500",
                          )}
                        >
                          <option value="">{shiftShort(c.regular && isWorkDay(d, c.regular) ? c.regular : null)}</option>
                          {allShifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {shiftShort(s)}
                            </option>
                          ))}
                          <option value="off">หยุด</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-stone-500">
            ช่องที่มีกรอบ = จัดเวรไว้ (ไม่ใช่กะประจำ) · ตัวเลือกแรกของแต่ละช่อง = กะประจำวันนั้น · <Badge tone="gray">ขาด/สาย</Badge> คิดตามตารางเวรนี้
          </p>
          <SubmitButton>บันทึกตารางเวร</SubmitButton>
        </div>
      </form>
    </>
  );
}
