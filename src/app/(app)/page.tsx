import { and, asc, count, countDistinct, desc, eq, gte, lt, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { attendanceLogs, branches, employeePhotos, employees, leaveTypes, payrollItems, payrollRuns, requests } from "@/db/schema";
import { Avatar } from "@/components/avatar";
import { BarChart, type BarDatum } from "@/components/bar-chart";
import { Icon } from "@/components/sidebar";
import { Badge, Card, DesktopOnly, Flash, MobileList, Stat, Table } from "@/components/ui";
import { approvableWhere } from "@/lib/approval";
import { requireUser } from "@/lib/auth";
import { loadAttendance } from "@/lib/attendance-data";
import { getSettings } from "@/lib/payroll-run";
import { addDays, atBkk, bkkDateStr, bkkTimeStr, fmtDate, fmtMonth, isoWeekday, WEEKDAY_TH } from "@/lib/time";
import { fmtMoney, fullName } from "@/lib/util";
import { RequestSummary, TypeBadge } from "./requests/request-detail";

export const metadata = { title: "หน้าหลัก" };

function greeting() {
  const h = Number(bkkTimeStr(new Date()).slice(0, 2));
  return h < 12 ? "สวัสดีตอนเช้า" : h < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = bkkDateStr();
  const from = atBkk(today);
  const to = atBkk(addDays(today, 1));
  const hr = user.role === "admin" || user.role === "hr";
  const approver = user.role !== "employee";

  const [settings, mine, [pendingMine], [lastSlip], pendingForMe] = await Promise.all([
    getSettings(),
    user.employeeId
      ? db
          .select()
          .from(attendanceLogs)
          .where(and(eq(attendanceLogs.employeeId, user.employeeId), gte(attendanceLogs.punchedAt, from), lt(attendanceLogs.punchedAt, to)))
          .orderBy(attendanceLogs.punchedAt)
      : Promise.resolve([]),
    user.employeeId
      ? db.select({ n: count() }).from(requests).where(and(eq(requests.employeeId, user.employeeId), eq(requests.status, "pending")))
      : Promise.resolve([{ n: 0 }]),
    user.employeeId
      ? db
          .select({ i: payrollItems, run: payrollRuns })
          .from(payrollItems)
          .innerJoin(payrollRuns, eq(payrollItems.runId, payrollRuns.id))
          .where(and(eq(payrollItems.employeeId, user.employeeId), eq(payrollRuns.status, "finalized")))
          .orderBy(desc(payrollRuns.year), desc(payrollRuns.month))
          .limit(1)
      : Promise.resolve([]),
    approver
      ? db
          .select({ r: requests, e: employees, leaveName: leaveTypes.name, photoAt: employeePhotos.updatedAt })
          .from(requests)
          .innerJoin(employees, eq(requests.employeeId, employees.id))
          .leftJoin(employeePhotos, eq(employeePhotos.employeeId, employees.id))
          .leftJoin(leaveTypes, eq(requests.leaveTypeId, leaveTypes.id))
          .where(and(eq(requests.status, "pending"), approvableWhere(user)))
          .orderBy(asc(requests.createdAt))
      : Promise.resolve([]),
  ]);
  const lastIn = mine.findLast((l) => l.type === "in");
  const lastOut = mine.findLast((l) => l.type === "out");
  const nextAction = mine.at(-1)?.type === "in" ? "สแกนออกงาน" : "สแกนเข้างาน";

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      {settings.announcement && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 shadow-card">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-lg" aria-hidden>
            📢
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-amber-700">ประกาศจากฝ่ายบุคคล</p>
            <p className="mt-0.5 text-[15px] whitespace-pre-line text-brand-900">{settings.announcement}</p>
          </div>
          {hr && (
            <Link href="/admin/settings" className="ml-auto shrink-0 text-xs text-amber-700 underline-offset-4 hover:underline">
              แก้ไข
            </Link>
          )}
        </div>
      )}
      {/* ส่วนต้อนรับ */}
      <section className="relative mb-6 overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_85%_0%,rgba(220,196,160,.45),transparent_45%),linear-gradient(125deg,#5e4830_0%,#3a2817_50%,#2c1e0f_100%)] p-5 text-white shadow-lift sm:p-7">
        <div className="pointer-events-none absolute -right-10 -bottom-16 size-56 rounded-full border-[28px] border-white/[.04]" />
        <div className="relative flex items-center gap-4">
          <Link href="/account" className="shrink-0" aria-label="โปรไฟล์ของฉัน">
            <Avatar name={user.displayName} employeeId={user.employeeId} version={user.photoVersion} size={64} className="ring-3 ring-brand-300/60" />
          </Link>
          <div className="min-w-0">
            <p className="text-sm text-brand-200/90">
              {WEEKDAY_TH[isoWeekday(today)]} {fmtDate(today)}
            </p>
            <h1 className="truncate text-[22px] font-semibold tracking-tight sm:text-[26px]">
              {greeting()}, {user.nickname || user.displayName.split(" ")[0]}
            </h1>
            {!user.photoVersion && user.employeeId && (
              <Link href="/account" className="mt-1 inline-block text-sm text-brand-200 underline-offset-4 hover:underline">
                + เพิ่มรูปโปรไฟล์ของคุณ
              </Link>
            )}
          </div>
        </div>

        {user.employeeId && (
          <div className="relative mt-5 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
            <Link href="/checkin" className="flex items-center gap-4 rounded-3xl bg-white p-4 text-brand-900 shadow-lg shadow-black/20 transition active:scale-[.99] sm:p-5">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow">
                <Icon name="finger" className="size-8" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold">{nextAction}</span>
                <span className="block text-sm text-brand-700">
                  เข้า {lastIn ? `${bkkTimeStr(lastIn.punchedAt)} น.` : "—"} · ออก {lastOut ? `${bkkTimeStr(lastOut.punchedAt)} น.` : "—"}
                </span>
              </span>
              <span className="ml-auto text-2xl text-brand-400">›</span>
            </Link>
            <Link href="/requests" className="rounded-3xl bg-white/[.08] p-4 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/[.12] sm:p-5">
              <span className="block text-sm text-brand-200/90">คำขอที่รออนุมัติ</span>
              <span className="mt-0.5 block text-[26px] font-semibold tabular-nums">{pendingMine.n} รายการ</span>
              <span className="text-sm text-brand-200">ยื่นลา / OT / แก้เวลา ›</span>
            </Link>
            <Link href="/payroll/my" className="rounded-3xl bg-white/[.08] p-4 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/[.12] sm:p-5">
              <span className="block text-sm text-brand-200/90">สลิปล่าสุด {lastSlip ? fmtMonth(lastSlip.run.year, lastSlip.run.month) : ""}</span>
              <span className="mt-0.5 block text-[26px] font-semibold tabular-nums">{lastSlip ? `${fmtMoney(lastSlip.i.net)} ฿` : "—"}</span>
              <span className="text-sm text-brand-200">ดูสลิปเงินเดือน ›</span>
            </Link>
          </div>
        )}
      </section>

      {approver && pendingForMe.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              รออนุมัติจากคุณ <Badge tone="red">{pendingForMe.length}</Badge>
            </span>
          }
          actions={
            <Link href="/requests/inbox" className="text-sm font-medium text-brand-700">
              ไปอนุมัติ ›
            </Link>
          }
          className="mb-5"
        >
          <ul className="divide-y divide-brand-100">
            {pendingForMe.slice(0, 4).map(({ r, e, leaveName, photoAt }) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[15px] sm:text-sm">
                <Avatar name={fullName(e)} employeeId={e.id} version={photoAt?.getTime()} size={32} />
                <TypeBadge type={r.type} />
                <span className="font-medium text-brand-900">{fullName(e)}</span>
                <span className="text-stone-600">
                  <RequestSummary r={r} leaveName={leaveName} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hr && <HrOverview today={today} from={from} to={to} />}
    </>
  );
}

async function HrOverview({ today, from, to }: { today: string; from: Date; to: Date }) {
  const start = addDays(today, -21);
  const [[emp], [present], byBranch, recent, att] = await Promise.all([
    db.select({ n: count() }).from(employees).where(ne(employees.status, "resigned")),
    db
      .select({ n: countDistinct(attendanceLogs.employeeId) })
      .from(attendanceLogs)
      .where(and(gte(attendanceLogs.punchedAt, from), lt(attendanceLogs.punchedAt, to), eq(attendanceLogs.type, "in"))),
    db
      .select({ id: branches.id, name: branches.name, n: count(employees.id) })
      .from(branches)
      .leftJoin(employees, and(eq(employees.branchId, branches.id), ne(employees.status, "resigned")))
      .groupBy(branches.id)
      .orderBy(desc(count(employees.id))),
    db
      .select({ log: attendanceLogs, e: employees, branch: branches.name, photoAt: employeePhotos.updatedAt })
      .from(attendanceLogs)
      .innerJoin(employees, eq(attendanceLogs.employeeId, employees.id))
      .leftJoin(employeePhotos, eq(employeePhotos.employeeId, employees.id))
      .leftJoin(branches, eq(attendanceLogs.branchId, branches.id))
      .where(and(gte(attendanceLogs.punchedAt, from), lt(attendanceLogs.punchedAt, to)))
      .orderBy(desc(attendanceLogs.punchedAt))
      .limit(12),
    loadAttendance({ start, end: addDays(today, -1) }),
  ]);

  // อัตรามาทำงาน = มาทำงาน / ต้องมาทำงาน (ไม่รวมวันลา) ของ 14 วันทำการล่าสุด (ไม่นับวันนี้ที่ยังไม่จบวัน)
  const daily = new Map<string, { scheduled: number; worked: number }>();
  for (const a of att)
    for (const d of a.days) {
      if (!d.scheduled || (d.leave && d.leave.portion >= 1)) continue;
      const cur = daily.get(d.date) ?? { scheduled: 0, worked: 0 };
      cur.scheduled++;
      if (d.status === "present" || d.status === "late" || d.status === "incomplete") cur.worked++;
      daily.set(d.date, cur);
    }
  const rate: BarDatum[] = [...daily.entries()]
    .filter(([, v]) => v.scheduled >= 3)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, v]) => {
      const pct = Math.round((v.worked / v.scheduled) * 100);
      return { key: date, label: `${Number(date.slice(8))}`, value: pct, display: `${pct}%`, detail: `${WEEKDAY_TH[isoWeekday(date)]} ${fmtDate(date)} · มา ${v.worked}/${v.scheduled} คน` };
    });
  const avg = rate.length ? Math.round(rate.reduce((s, d) => s + d.value, 0) / rate.length) : 0;
  const branchData: BarDatum[] = byBranch.map((b) => ({ key: String(b.id), label: b.name, value: b.n, display: String(b.n), detail: `${b.name} ${b.n} คน` }));
  const notIn = Math.max(0, emp.n - present.n);

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="พนักงานทั้งหมด" value={emp.n} icon={<Icon name="people" className="size-4" />} />
        <Stat label="ลงเวลาเข้าวันนี้" value={present.n} tone="good" icon={<Icon name="finger" className="size-4" />} />
        <Stat label="ยังไม่ลงเวลา" value={notIn} tone="warn" hint="รวมคนที่วันนี้หยุด/ลา/กะดึก" icon={<Icon name="clock" className="size-4" />} />
        <Stat label="มาทำงานเฉลี่ย 14 วัน" value={`${avg}%`} icon={<Icon name="chart" className="size-4" />} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card title="อัตรามาทำงาน 14 วันทำการล่าสุด">
          <BarChart data={rate} max={100} ariaLabel="อัตรามาทำงานรายวัน (%)" />
        </Card>
        <Card title="พนักงานแยกตามสาขา">
          <BarChart data={branchData} orientation="horizontal" ariaLabel="จำนวนพนักงานแยกตามสาขา" />
        </Card>
      </div>

      <Card
        title="ลงเวลาล่าสุดวันนี้"
        actions={
          <Link href="/attendance/board" className="text-sm font-medium text-brand-700">
            ดูทั้งหมด ›
          </Link>
        }
        padded={false}
      >
        <MobileList empty={recent.length === 0}>
          <ul className="divide-y divide-brand-100">
            {recent.map(({ log, e, branch, photoAt }) => (
              <li key={log.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={fullName(e)} employeeId={e.id} version={photoAt?.getTime()} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-brand-900">{fullName(e)}</span>
                  <span className="block truncate text-sm text-stone-500">
                    {bkkTimeStr(log.punchedAt)} น. · {branch ?? log.note ?? "-"}
                  </span>
                </span>
                <Badge tone={log.type === "in" ? "green" : "gold"}>{log.type === "in" ? "เข้า" : "ออก"}</Badge>
              </li>
            ))}
          </ul>
        </MobileList>
        <DesktopOnly>
          <div className="p-4">
            <Table head={["เวลา", "พนักงาน", "ประเภท", "สาขา", "ระยะจากสาขา"]} empty={recent.length === 0}>
              {recent.map(({ log, e, branch, photoAt }) => (
                <tr key={log.id}>
                  <td className="font-medium tabular-nums">{bkkTimeStr(log.punchedAt)}</td>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={fullName(e)} employeeId={e.id} version={photoAt?.getTime()} size={30} />
                      <span>
                        {fullName(e)} <span className="text-xs text-stone-400">{e.code}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <Badge tone={log.type === "in" ? "green" : "gold"}>{log.type === "in" ? "เข้า" : "ออก"}</Badge>
                  </td>
                  <td>{branch ?? <span className="text-amber-700">{log.note ?? "-"}</span>}</td>
                  <td className="tabular-nums">{log.distanceM != null ? `${Math.round(log.distanceM)} ม.` : "-"}</td>
                </tr>
              ))}
            </Table>
          </div>
        </DesktopOnly>
      </Card>
    </>
  );
}

