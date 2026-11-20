import { asc, inArray, ne } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { EmployeePicker } from "@/components/employee-picker";
import { FilterBar, StepNav } from "@/components/filter-bar";
import { DesktopOnly, MobileCard, MobileList, Stat, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadAttendance } from "@/lib/attendance-data";
import { canSeeEmployee, visibleEmployeeIds } from "@/lib/scope";
import { bkkDateStr, bkkTimeStr, fmtMonth, isoWeekday, monthRange, WEEKDAY_TH } from "@/lib/time";
import { fullName } from "@/lib/util";
import { DayStatusBadge } from "../status-badge";

export const metadata = { title: "เวลาทำงานรายเดือน" };

function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function MyAttendance({ searchParams }: { searchParams: Promise<{ employee?: string; month?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const empId = Number(sp.employee) || u.employeeId;
  if (!empId) redirect("/attendance/board");
  if (!(await canSeeEmployee(u, empId))) redirect("/attendance/me");

  const ym = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : bkkDateStr().slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const { start, end } = monthRange(y, m);

  const ids = await visibleEmployeeIds(u);
  const pickable =
    u.role === "employee"
      ? []
      : await db
          .select()
          .from(employees)
          .where(ids ? inArray(employees.id, ids) : ne(employees.status, "resigned"))
          .orderBy(asc(employees.code));

  const [row] = await loadAttendance({ start, end, employeeIds: [empId], includeResigned: true });
  const q = (o: Record<string, string>) => "?" + new URLSearchParams({ ...(sp.employee ? { employee: sp.employee } : {}), ...o }).toString();

  return (
    <>
      <FilterBar>
        <StepNav label={fmtMonth(y, m)} prev={q({ month: shiftMonth(ym, -1) })} next={q({ month: shiftMonth(ym, 1) })} />
        {pickable.length > 0 && (
          <EmployeePicker
            key={empId}
            variant="filter"
            syncParam="employee"
            allowClear={u.employeeId ? "ตัวฉันเอง" : undefined}
            defaultValue={empId}
            options={pickable.map((e) => ({ id: e.id, code: e.code, name: fullName(e), nickname: e.nickname }))}
            className="min-w-60 flex-1 sm:max-w-80"
          />
        )}
      </FilterBar>

      {!row ? (
        <p className="text-stone-500">ไม่มีข้อมูลการจ้างงานในเดือนนี้</p>
      ) : (
        <>
          <h2 className="mb-3 font-semibold">
            {fullName(row.employee)} <span className="text-sm font-normal text-stone-400">{row.employee.code}</span>
            <span className="ml-2 text-sm font-normal text-stone-500">
              กะ {row.shift ? `${row.shift.name}` : "08:00-17:00 (ค่าเริ่มต้น)"}
            </span>
          </h2>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
            <Stat label="วันทำงาน" value={row.totals.scheduled} />
            <Stat label="มาทำงาน" value={row.totals.worked} tone="good" />
            <Stat label="สาย" value={`${row.totals.lateCount} ครั้ง`} hint={`${row.totals.lateMinutes} นาที`} tone="warn" />
            <Stat label="ขาด" value={row.totals.absent} tone="bad" />
            <Stat label="ลา" value={row.totals.paidLeave + row.totals.unpaidLeave} />
            <Stat label="ลงเวลาไม่ครบ" value={row.totals.incomplete} tone="warn" />
          </div>
          <MobileList>
            {row.days
              .filter((d) => d.status !== "not_employed" && d.status !== "future")
              .reverse()
              .map((d) => (
                <MobileCard key={d.date} className={!d.scheduled ? "bg-brand-50/60" : ""}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-brand-900">
                      {WEEKDAY_TH[isoWeekday(d.date)]} {Number(d.date.slice(8))}
                    </div>
                    <DayStatusBadge d={d} />
                  </div>
                  {(d.firstIn || d.lastOut) && (
                    <div className="mt-1.5 flex gap-4 text-[15px] tabular-nums text-stone-700">
                      <span>เข้า {d.firstIn ? bkkTimeStr(d.firstIn) : "-"}</span>
                      <span>ออก {d.lastOut ? bkkTimeStr(d.lastOut) : "-"}</span>
                      {d.lateMinutes > 0 && <span className="text-amber-700">สาย {d.lateMinutes} น.</span>}
                    </div>
                  )}
                </MobileCard>
              ))}
          </MobileList>
          <DesktopOnly>
            <Table head={["วันที่", "เข้า", "ออก", "ชั่วโมงงาน", "สาย", "ออกก่อน", "สถานะ"]}>
              {row.days.map((d) => (
                <tr key={d.date} className={!d.scheduled ? "bg-stone-50/60 text-stone-400" : ""}>
                  <td className="whitespace-nowrap">
                    {WEEKDAY_TH[isoWeekday(d.date)]} {Number(d.date.slice(8))}
                  </td>
                  <td className="tabular-nums">{d.firstIn ? bkkTimeStr(d.firstIn) : "-"}</td>
                  <td className="tabular-nums">{d.lastOut ? bkkTimeStr(d.lastOut) : "-"}</td>
                  <td>{d.workedMinutes ? `${Math.floor(d.workedMinutes / 60)}:${String(d.workedMinutes % 60).padStart(2, "0")}` : "-"}</td>
                  <td>{d.lateMinutes ? `${d.lateMinutes} น.` : "-"}</td>
                  <td>{d.earlyMinutes ? `${d.earlyMinutes} น.` : "-"}</td>
                  <td>
                    <DayStatusBadge d={d} />
                  </td>
                </tr>
              ))}
            </Table>
          </DesktopOnly>
          {u.employeeId === empId && (
            <p className="mt-3 text-sm text-stone-500">
              ลืมสแกนหรือเวลาไม่ถูกต้อง?{" "}
              <Link href="/requests/new?type=time_correction" className="text-brand-600 underline">
                ส่งคำขอแก้ไขเวลา
              </Link>
            </p>
          )}
        </>
      )}
    </>
  );
}
