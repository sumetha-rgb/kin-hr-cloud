import { asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { DateRangeNav, FilterBar, FilterSelect } from "@/components/filter-bar";
import { Badge, DesktopOnly, MobileCard, MobileList, Stat, Table } from "@/components/ui";
import { totals } from "@/lib/attendance";
import { requireRole } from "@/lib/auth";
import { loadAttendance } from "@/lib/attendance-data";
import { parseRange } from "@/lib/range";
import { visibleEmployeeIds } from "@/lib/scope";
import { bkkTimeStr } from "@/lib/time";
import { fullName } from "@/lib/util";
import { DayStatusBadge } from "../status-badge";

export const metadata = { title: "สรุปการลงเวลา" };

const hm = (min: number) => (min ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}` : "-");

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ date?: string; from?: string; to?: string; branch?: string }> }) {
  const u = await requireRole("admin", "hr", "manager");
  const sp = await searchParams;
  const r = parseRange(sp);
  const [ids, br] = await Promise.all([visibleEmployeeIds(u), db.select().from(branches).orderBy(asc(branches.code))]);
  let rows = await loadAttendance({ start: r.from, end: r.to, employeeIds: ids });
  if (sp.branch) rows = rows.filter((x) => x.employee.branchId === Number(sp.branch));
  const branchName = new Map(br.map((b) => [b.id, b.name]));

  return (
    <>
      <FilterBar>
        <DateRangeNav
          from={r.from}
          to={r.to}
          today={r.today}
          prev={r.prev}
          next={r.next}
          label={r.label}
          sublabel={r.single ? (r.from === r.today ? "วันนี้" : undefined) : `${r.days} วัน`}
        />
        <FilterSelect param="branch" value={sp.branch ?? ""} label="สาขา" options={br.map((b) => ({ value: b.id, label: b.name }))} className="min-w-44 flex-1 sm:flex-none" />
        <span className="ml-auto hidden px-3 text-sm text-stone-500 md:inline">{rows.length} คน</span>
      </FilterBar>

      {r.single ? <SingleDay rows={rows} date={r.from} branchName={branchName} /> : <RangeSummary rows={rows} from={r.from} branchName={branchName} />}
    </>
  );
}

type Rows = Awaited<ReturnType<typeof loadAttendance>>;

function SingleDay({ rows, date, branchName }: { rows: Rows; date: string; branchName: Map<number, string> }) {
  const count = (s: string[]) => rows.filter((x) => s.includes(x.days[0]?.status)).length;
  return (
    <>
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
                <div className="font-semibold tabular-nums">{hm(d?.workedMinutes ?? 0)}</div>
              </div>
            </div>
          </MobileCard>
        ))}
      </MobileList>
      <DesktopOnly>
        <Table head={["รหัส", "พนักงาน", "สาขา", "กะ", "เข้า", "ออก", "ชั่วโมงงาน", "สถานะ"]} empty={!rows.length}>
          {rows.map(({ employee: e, shift, days: [d] }) => (
            <tr key={e.id} data-href={`/attendance/me?employee=${e.id}&month=${date.slice(0, 7)}`}>
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
              <td>{hm(d?.workedMinutes ?? 0)}</td>
              <td>{d && <DayStatusBadge d={d} />}</td>
            </tr>
          ))}
        </Table>
      </DesktopOnly>
    </>
  );
}

/** สรุปทั้งช่วง: รายคน (วันต้องทำงาน / มา / สาย / ขาด / ลา / ชั่วโมงรวม) */
function RangeSummary({ rows, from, branchName }: { rows: Rows; from: string; branchName: Map<number, string> }) {
  const list = rows.map((x) => {
    const t = totals(x.days);
    const minutes = x.days.reduce((s, d) => s + d.workedMinutes, 0);
    const rate = t.scheduled ? Math.round((t.worked / Math.max(1, t.scheduled - t.paidLeave - t.unpaidLeave)) * 100) : null;
    return { ...x, t, minutes, rate };
  });
  const sum = list.reduce(
    (s, x) => ({ worked: s.worked + x.t.worked, late: s.late + x.t.lateCount, absent: s.absent + x.t.absent, leave: s.leave + x.t.paidLeave + x.t.unpaidLeave, minutes: s.minutes + x.minutes }),
    { worked: 0, late: 0, absent: 0, leave: 0, minutes: 0 },
  );
  const month = from.slice(0, 7);
  const rateTone = (p: number | null) => (p == null ? "gray" : p >= 95 ? "green" : p >= 80 ? "amber" : "red");

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="มาทำงาน (คน-วัน)" value={sum.worked} tone="good" />
        <Stat label="มาสาย (ครั้ง)" value={sum.late} tone="warn" />
        <Stat label="ขาดงาน (วัน)" value={sum.absent} tone="bad" />
        <Stat label="ลา (วัน)" value={sum.leave % 1 ? sum.leave.toFixed(1) : sum.leave} />
        <Stat label="ชั่วโมงงานรวม" value={hm(sum.minutes)} />
      </div>

      <MobileList empty={!list.length}>
        {list.map(({ employee: e, t, minutes, rate }) => (
          <MobileCard key={e.id} href={`/attendance/me?employee=${e.id}&month=${month}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold text-brand-900">{fullName(e)}</div>
                <div className="text-sm text-stone-500">{e.branchId ? branchName.get(e.branchId) : "-"}</div>
              </div>
              <Badge tone={rateTone(rate)}>{rate == null ? "ไม่มีวันทำงาน" : `มา ${rate}%`}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 rounded-xl bg-brand-50 p-2 text-center text-sm">
              {[
                ["มา", `${t.worked}/${t.scheduled}`],
                ["สาย", t.lateCount],
                ["ขาด", t.absent],
                ["ชม.", hm(minutes)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-stone-500">{k}</div>
                  <div className="font-semibold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </MobileCard>
        ))}
      </MobileList>
      <DesktopOnly>
        <Table head={["รหัส", "พนักงาน", "สาขา", "มา / ต้องทำงาน", "สาย", "ขาด", "ลา", "ชั่วโมงรวม", "อัตรามา"]} empty={!list.length}>
          {list.map(({ employee: e, t, minutes, rate }) => (
            <tr key={e.id} data-href={`/attendance/me?employee=${e.id}&month=${month}`}>
              <td>{e.code}</td>
              <td>
                <Link href={`/attendance/me?employee=${e.id}&month=${month}`} className="text-brand-600">
                  {fullName(e)}
                </Link>
              </td>
              <td>{e.branchId ? branchName.get(e.branchId) : "-"}</td>
              <td className="tabular-nums">
                {t.worked} / {t.scheduled} วัน
              </td>
              <td className="tabular-nums">{t.lateCount ? <span className="text-amber-700">{t.lateCount} ครั้ง ({t.lateMinutes} นาที)</span> : "-"}</td>
              <td className="tabular-nums">{t.absent ? <span className="text-rose-700">{t.absent} วัน</span> : "-"}</td>
              <td className="tabular-nums">{t.paidLeave + t.unpaidLeave || "-"}</td>
              <td className="tabular-nums">{hm(minutes)}</td>
              <td>
                <Badge tone={rateTone(rate)}>{rate == null ? "-" : `${rate}%`}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      </DesktopOnly>
    </>
  );
}
