import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { departments, employees, holidays, leaveTypes, requests } from "@/db/schema";
import { FilterBar, FilterSelect, StepNav } from "@/components/filter-bar";
import { Icon } from "@/components/icons";
import { Badge, Table } from "@/components/ui";
import { teamOf } from "@/lib/approval";
import { isHR, requireUser } from "@/lib/auth";
import { addDays, bkkDateStr, eachDate, fmtDate, fmtDateLong, fmtMonth, isoWeekday, monthRange } from "@/lib/time";
import { cn, fullName } from "@/lib/util";

export const metadata = { title: "ปฏิทินการลา" };

const WD = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

export default async function LeaveCalendar({ searchParams }: { searchParams: Promise<{ m?: string; dept?: string; day?: string }> }) {
  const u = await requireUser();
  if (u.role === "employee") redirect("/requests/mine");
  const sp = await searchParams;
  const hr = isHR(u);
  const today = bkkDateStr();
  const [y, m] = (/^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7)).split("-").map(Number);
  const { start, end } = monthRange(y, m);
  const ym = (yy: number, mm: number) => `${mm === 0 ? yy - 1 : mm === 13 ? yy + 1 : yy}-${String(mm === 0 ? 12 : mm === 13 ? 1 : mm).padStart(2, "0")}`;

  // ขอบเขต: HR เห็นทุกแผนก (กรองได้) · หัวหน้าเห็นลูกทีม
  const deptId = Number(sp.dept) || null;
  const scope = hr ? null : u.employeeId ? [...(await teamOf(u.employeeId)), u.employeeId] : [];
  const [rows, hol, depts] = await Promise.all([
    db
      .select({ r: requests, e: employees, leave: leaveTypes.code, leaveName: leaveTypes.name, deptName: departments.name })
      .from(requests)
      .innerJoin(employees, eq(requests.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(leaveTypes, eq(requests.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(requests.type, "leave"),
          inArray(requests.status, ["approved", "pending"]),
          lte(requests.startDate, end),
          gte(requests.endDate, start),
          scope ? inArray(requests.employeeId, scope.length ? scope : [-1]) : undefined,
          deptId ? eq(employees.departmentId, deptId) : undefined,
        ),
      )
      .orderBy(asc(employees.firstName)),
    db
      .select()
      .from(holidays)
      .where(and(gte(holidays.date, start), lte(holidays.date, end))),
    hr ? db.select().from(departments).orderBy(asc(departments.name)) : Promise.resolve([]),
  ]);
  const holiday = new Map(hol.map((h) => [h.date, h.name]));
  const byDate = new Map<string, typeof rows>();
  for (const x of rows)
    for (const d of eachDate(x.r.startDate! < start ? start : x.r.startDate!, x.r.endDate! > end ? end : x.r.endDate!)) {
      if (isoWeekday(d) >= 6 || holiday.has(d)) continue; // นับเฉพาะวันทำงาน
      byDate.set(d, [...(byDate.get(d) ?? []), x]);
    }

  // ตารางเดือน เริ่มวันจันทร์
  const first = addDays(start, -(isoWeekday(start) - 1));
  const last = addDays(end, 7 - isoWeekday(end));
  const days = eachDate(first, last);

  // กดวัน → แสดงรายละเอียดการลาของวันนั้น (กดซ้ำ = ปิด)
  const base = `?m=${ym(y, m)}${deptId ? `&dept=${deptId}` : ""}`;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? "") && sp.day! >= start && sp.day! <= end ? sp.day! : null;
  const dayHref = (d: string) => (d === day ? base : `${base}&day=${d}#day`);
  const dayList = day ? (byDate.get(day) ?? []) : [];

  return (
    <>
      <FilterBar>
        <StepNav prev={`?m=${ym(y, m - 1)}${deptId ? `&dept=${deptId}` : ""}`} next={`?m=${ym(y, m + 1)}${deptId ? `&dept=${deptId}` : ""}`} label={fmtMonth(y, m)} />
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
        <span className="ml-auto hidden items-center gap-3 px-3 text-xs text-stone-500 md:flex">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-sky-500" /> อนุมัติแล้ว
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full border-2 border-amber-500" /> รออนุมัติ
          </span>
        </span>
      </FilterBar>

      {/* คอม: ตารางเดือน */}
      <div className="hidden overflow-hidden rounded-3xl border border-brand-200/80 bg-white shadow-card md:block">
        <div className="grid grid-cols-7 border-b border-brand-100 bg-brand-50/60 text-center text-xs font-medium text-brand-700">
          {WD.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const inMonth = d >= start && d <= end;
            const list = byDate.get(d) ?? [];
            const weekend = isoWeekday(d) >= 6;
            return (
              <Link
                key={d}
                href={inMonth ? dayHref(d) : base}
                aria-label={`วันที่ ${Number(d.slice(8))} ลา ${list.length} คน`}
                className={cn(
                  "block min-h-28 border-r border-b border-brand-100 p-1.5 text-xs transition [&:nth-child(7n)]:border-r-0",
                  !inMonth && "pointer-events-none bg-stone-50/70 text-stone-300",
                  inMonth && (weekend || holiday.has(d)) && "bg-stone-50",
                  inMonth && "hover:bg-brand-50/70",
                  d === day && "bg-brand-50 ring-2 ring-brand-400 ring-inset",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn("inline-flex size-6 items-center justify-center rounded-full", d === today && "bg-brand-700 font-semibold text-white")}>
                    {Number(d.slice(8))}
                  </span>
                  {inMonth && list.length > 0 && <span className="font-semibold text-brand-700">{list.length} คน</span>}
                </div>
                {inMonth && holiday.has(d) && <p className="truncate text-[11px] text-rose-600">{holiday.get(d)}</p>}
                {inMonth &&
                  list.slice(0, 4).map(({ r, e, leave, leaveName }) => (
                    <p
                      key={r.id}
                      title={`${e.firstName} ${e.lastName} · ${leaveName}${r.status === "pending" ? " (รออนุมัติ)" : ""}`}
                      className={cn(
                        "mb-0.5 truncate rounded-md px-1.5 py-0.5",
                        r.status === "approved" ? "bg-sky-100 text-sky-900" : "bg-white text-amber-800 ring-1 ring-amber-400 ring-inset",
                      )}
                    >
                      <b>{leave}</b> {e.nickname || e.firstName}
                    </p>
                  ))}
                {inMonth && list.length > 4 && <p className="text-[11px] text-stone-500">+ อีก {list.length - 4} คน</p>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* มือถือ: รายการตามวัน */}
      <div className="space-y-2 md:hidden">
        {eachDate(start, end)
          .filter((d) => byDate.has(d))
          .map((d) => (
            <div key={d} className="rounded-2xl border border-brand-200/80 bg-white p-3 shadow-card">
              <Link href={dayHref(d)} className="mb-1.5 flex items-center justify-between text-sm font-semibold text-brand-900">
                {WD[isoWeekday(d) - 1]} {Number(d.slice(8))} · ลา {byDate.get(d)!.length} คน
                <span className="text-xs font-normal text-brand-600">{d === day ? "ซ่อน" : "ดูรายละเอียด"}</span>
              </Link>
              <div className="flex flex-wrap gap-1.5">
                {byDate.get(d)!.map(({ r, e, leave }) => (
                  <span
                    key={r.id}
                    className={cn("rounded-full px-2.5 py-1 text-xs", r.status === "approved" ? "bg-sky-100 text-sky-900" : "text-amber-800 ring-1 ring-amber-400")}
                  >
                    <b>{leave}</b> {e.firstName} {e.lastName}
                    {r.status === "pending" && " · รออนุมัติ"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        {byDate.size === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500">เดือนนี้ไม่มีใครลา</p>}
      </div>

      {day && (
        <section id="day" className="mt-5 scroll-mt-6 rounded-3xl border border-brand-200/80 bg-white p-4 shadow-card sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-brand-900">การลาวันที่ {fmtDateLong(day)}</h2>
              <p className="text-sm text-stone-500">
                {holiday.get(day) ? `วันหยุด: ${holiday.get(day)}` : isoWeekday(day) >= 6 ? "วันหยุดสุดสัปดาห์" : `ลา ${dayList.length} คน`}
              </p>
            </div>
            <Link href={base} className="inline-flex items-center gap-1 rounded-full border border-brand-200 px-3 py-1 text-sm text-brand-700 hover:bg-brand-50">
              <Icon name="x" className="size-4" /> ปิด
            </Link>
          </div>
          <Table head={["พนักงาน", "ประเภทการลา", "ช่วงวันที่", "สถานะ", "เหตุผล"]} empty={!dayList.length}>
            {dayList.map(({ r, e, leave, leaveName, deptName }) => (
              <tr key={r.id} data-href={`/attendance/me?employee=${e.id}&month=${ym(y, m)}`}>
                <td>
                  <Link href={`/attendance/me?employee=${e.id}&month=${ym(y, m)}`} className="block font-medium text-brand-900">
                    {fullName(e)}
                  </Link>
                  <span className="text-xs text-stone-500">
                    {e.code}
                    {deptName ? ` · ${deptName}` : ""}
                  </span>
                </td>
                <td>
                  <b className="mr-1">{leave}</b>
                  {leaveName}
                </td>
                <td className="whitespace-nowrap">
                  {fmtDate(r.startDate)}
                  {r.endDate !== r.startDate && ` – ${fmtDate(r.endDate)}`} <span className="text-stone-500">({Number(r.days)} วัน)</span>
                </td>
                <td>
                  <Badge tone={r.status === "approved" ? "green" : r.headApprovedAt ? "blue" : "amber"}>
                    {r.status === "approved" ? "อนุมัติแล้ว" : r.headApprovedAt ? "หัวหน้าอนุมัติแล้ว · รอ HR" : "รออนุมัติ"}
                  </Badge>
                </td>
                <td className="text-stone-500">{r.reason || "-"}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}
    </>
  );
}
