import { asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { DateNav, FilterBar, FilterSelect } from "@/components/filter-bar";
import { DesktopOnly, MobileCard, MobileList, Stat, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { loadAttendance } from "@/lib/attendance-data";
import { visibleEmployeeIds } from "@/lib/scope";
import { addDays, bkkDateStr, bkkTimeStr, fmtDate, isoWeekday, WEEKDAY_TH } from "@/lib/time";
import { fullName } from "@/lib/util";
import { DayStatusBadge } from "../status-badge";

export const metadata = { title: "สรุปการลงเวลารายวัน" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ date?: string; branch?: string }> }) {
  const u = await requireRole("admin", "hr", "manager");
  const sp = await searchParams;
  const today = bkkDateStr();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const [ids, br] = await Promise.all([visibleEmployeeIds(u), db.select().from(branches).orderBy(asc(branches.code))]);
  let rows = await loadAttendance({ start: date, end: date, employeeIds: ids });
  if (sp.branch) rows = rows.filter((r) => r.employee.branchId === Number(sp.branch));
  const branchName = new Map(br.map((b) => [b.id, b.name]));

  const count = (s: string[]) => rows.filter((r) => s.includes(r.days[0]?.status)).length;

  return (
    <>
      <FilterBar>
        <DateNav
          date={date}
          today={today}
          prev={addDays(date, -1)}
          next={addDays(date, 1)}
          label={`${WEEKDAY_TH[isoWeekday(date)]} ${fmtDate(date)}`}
          sublabel={date === today ? "วันนี้" : undefined}
        />
        <FilterSelect param="branch" value={sp.branch ?? ""} placeholder="ทุกสาขา" options={br.map((b) => ({ value: b.id, label: b.name }))} className="min-w-44 flex-1 sm:flex-none" />
        <span className="ml-auto hidden px-3 text-sm text-stone-500 md:inline">{rows.length} คน</span>
      </FilterBar>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="มาทำงาน" value={count(["present", "late", "incomplete"])} tone="good" />
        <Stat label="มาสาย" value={count(["late"])} tone="warn" />
        <Stat label="ขาด / ยังไม่มา" value={count(["absent", "future"])} tone="bad" />
        <Stat label="ลา" value={count(["leave"])} />
        <Stat label="วันหยุด" value={count(["off", "holiday"])} />
      </div>

      <MobileList empty={!rows.length}>
        {rows.map(({ employee: e, days: [d] }) => (
          <MobileCard key={e.id} href={`/attendance/me?employee=${e.id}&month=${date.slice(0, 7)}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold text-brand-900">{fullName(e)}</div>
                <div className="text-sm text-stone-500">{e.branchId ? branchName.get(e.branchId) : "-"}</div>
              </div>
              {d && <DayStatusBadge d={d} />}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-brand-50 p-2 text-center text-sm">
              <div>
                <div className="text-xs text-stone-500">เข้า</div>
                <div className="font-semibold tabular-nums">{d?.firstIn ? bkkTimeStr(d.firstIn) : "-"}</div>
              </div>
              <div>
                <div className="text-xs text-stone-500">ออก</div>
                <div className="font-semibold tabular-nums">{d?.lastOut ? bkkTimeStr(d.lastOut) : "-"}</div>
              </div>
              <div>
                <div className="text-xs text-stone-500">ชั่วโมง</div>
                <div className="font-semibold tabular-nums">{d?.workedMinutes ? `${Math.floor(d.workedMinutes / 60)}:${String(d.workedMinutes % 60).padStart(2, "0")}` : "-"}</div>
              </div>
            </div>
          </MobileCard>
        ))}
      </MobileList>
      <DesktopOnly>
        <Table head={["รหัส", "พนักงาน", "สาขา", "กะ", "เข้า", "ออก", "ชั่วโมงงาน", "สถานะ"]} empty={!rows.length}>
          {rows.map(({ employee: e, shift, days: [d] }) => (
            <tr key={e.id}>
              <td>{e.code}</td>
              <td>
                <Link href={`/attendance/me?employee=${e.id}&month=${date.slice(0, 7)}`} className="text-brand-600">
                  {fullName(e)}
                </Link>
              </td>
              <td>{e.branchId ? branchName.get(e.branchId) : "-"}</td>
              <td className="text-xs text-stone-500">{shift ? `${shift.startTime}-${shift.endTime}` : "08:00-17:00"}</td>
              <td className="tabular-nums">{d?.firstIn ? bkkTimeStr(d.firstIn) : "-"}</td>
              <td className="tabular-nums">{d?.lastOut ? bkkTimeStr(d.lastOut) : "-"}</td>
              <td>{d?.workedMinutes ? `${Math.floor(d.workedMinutes / 60)}:${String(d.workedMinutes % 60).padStart(2, "0")}` : "-"}</td>
              <td>{d && <DayStatusBadge d={d} />}</td>
            </tr>
          ))}
        </Table>
      </DesktopOnly>
    </>
  );
}
