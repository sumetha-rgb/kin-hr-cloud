import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { departments, employees, payrollItems, payrollRuns, positions, requests } from "@/db/schema";
import { BarChart, type BarDatum } from "@/components/bar-chart";
import { StepNav } from "@/components/filter-bar";
import { Icon } from "@/components/icons";
import { Card, PageHeader, Stat, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { loadAttendance } from "@/lib/attendance-data";
import { bkkDateStr, fmtMonth, monthRange } from "@/lib/time";
import { cn, fmtMoney, fullName } from "@/lib/util";

export const metadata = { title: "ภาพรวมผู้บริหาร" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
/** คีย์แผนกใน URL (ไม่มีแผนก = none) */
const deptKey = (id: number | null) => (id ? String(id) : "none");

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const today = bkkDateStr();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const { start, end } = monthRange(y, m);
  const ym = (yy: number, mm: number) => (mm < 1 ? `${yy - 1}-12` : mm > 12 ? `${yy + 1}-01` : `${yy}-${String(mm).padStart(2, "0")}`);
  const yStart = `${y}-01-01`;

  // ตัวเลขรายคน แล้วค่อยรวมเป็นรายแผนก (กดแผนก → เห็นรายคนได้)
  const [depts, emps, att, payroll, leaveYtd, otReq] = await Promise.all([
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select({ e: employees, pos: positions.name }).from(employees).leftJoin(positions, eq(employees.positionId, positions.id)).orderBy(asc(employees.code)),
    loadAttendance({ start, end: end > today ? today : end }),
    // ค่า OT และรายได้ของงวดเดือนนี้ (ถ้าคำนวณแล้ว)
    db
      .select({ emp: payrollItems.employeeId, ot: payrollItems.otAmount, otHours: payrollItems.otHours, gross: payrollItems.gross })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.runId, payrollRuns.id))
      .where(and(eq(payrollRuns.year, y), eq(payrollRuns.month, m))),
    // วันลาที่ใช้ไปตั้งแต่ต้นปี
    db
      .select({ emp: requests.employeeId, days: sql<string>`coalesce(sum(${requests.days}), 0)` })
      .from(requests)
      .where(and(eq(requests.type, "leave"), eq(requests.status, "approved"), gte(requests.startDate, yStart), lte(requests.startDate, end)))
      .groupBy(requests.employeeId),
    // ชั่วโมง OT ที่อนุมัติในเดือน (ใช้เมื่อยังไม่มีงวดเงินเดือน)
    db
      .select({ emp: requests.employeeId, hours: sql<string>`coalesce(sum(${requests.otHours}), 0)` })
      .from(requests)
      .where(and(eq(requests.type, "ot"), eq(requests.status, "approved"), gte(requests.otDate, start), lte(requests.otDate, end)))
      .groupBy(requests.employeeId),
  ]);
  const deptName = new Map(depts.map((d) => [d.id, d.name]));
  const name = (id: number | null) => (id ? (deptName.get(id) ?? "-") : "ไม่ระบุแผนก");
  const deptOf = new Map(emps.map(({ e }) => [e.id, e.departmentId]));
  const hasPayroll = payroll.length > 0;

  // ข้อมูลรายคน
  const payBy = new Map(payroll.map((p) => [p.emp, p]));
  const leaveBy = new Map(leaveYtd.map((l) => [l.emp, Number(l.days)]));
  const otHoursBy = new Map(otReq.map((o) => [o.emp, Number(o.hours)]));
  const attBy = new Map(att.map((a) => [a.employee.id, a.totals]));
  const otOf = (id: number) => (hasPayroll ? Number(payBy.get(id)?.ot ?? 0) : (otHoursBy.get(id) ?? 0));

  // กำลังคน / การลาออก (ตั้งแต่ต้นปี)
  const active = emps.filter(({ e }) => e.status !== "resigned" || (e.endDate && e.endDate > end));
  const hired = emps.filter(({ e }) => e.startDate >= yStart && e.startDate <= end).length;
  const left = emps.filter(({ e }) => e.endDate && e.endDate >= yStart && e.endDate <= end).length;
  const turnover = pct(left, active.length + left);

  // รวมรายแผนก
  type Agg = { ot: number; late: number; minutes: number; absent: number; scheduled: number; leave: number; head: number };
  const agg = new Map<number | null, Agg>();
  const get = (k: number | null) => agg.get(k) ?? (agg.set(k, { ot: 0, late: 0, minutes: 0, absent: 0, scheduled: 0, leave: 0, head: 0 }), agg.get(k)!);
  for (const { e } of emps) {
    const a = get(e.departmentId);
    const t = attBy.get(e.id);
    a.ot += otOf(e.id);
    a.leave += leaveBy.get(e.id) ?? 0;
    if (t) {
      a.late += t.lateCount;
      a.minutes += t.lateMinutes;
      a.absent += t.absent;
      a.scheduled += t.scheduled;
    }
  }
  for (const { e } of active) get(e.departmentId).head++;
  const sum = (k: keyof Agg) => [...agg.values()].reduce((s, v) => s + v[k], 0);
  const totalGross = payroll.reduce((s, p) => s + Number(p.gross), 0);

  // กดแผนก → ลิงก์มาที่หน้าเดิมพร้อม ?d= และเลื่อนไปการ์ดรายละเอียด
  const sel = sp.d ?? null;
  const href = (k: number | null) => (sel === deptKey(k) ? `?m=${month}` : `?m=${month}&d=${deptKey(k)}#dept`);
  const bars = (pick: (a: Agg) => number, display: (v: number, a: Agg) => string, detail?: (a: Agg) => string): BarDatum[] =>
    [...agg]
      .filter(([, a]) => pick(a) > 0)
      .sort(([a], [b]) => name(a).localeCompare(name(b), "th"))
      .map(([k, a]) => ({ key: deptKey(k), label: name(k), value: pick(a), display: display(pick(a), a), detail: detail?.(a), href: href(k), selected: sel === deptKey(k) }));
  const otData = bars((a) => a.ot, (v) => (hasPayroll ? fmtMoney(v) : `${v} ชม.`));
  const lateData = bars((a) => a.late, (v) => `${v} ครั้ง`, (a) => `${a.minutes} นาที`);
  const leaveData = bars((a) => a.leave, (v) => `${v} วัน`);
  const headData = bars((a) => a.head, (v) => `${v} คน`);

  // รายละเอียดแผนกที่เลือก (รายคน)
  const selId = sel === "none" ? null : Number(sel);
  const members = sel
    ? active
        .filter(({ e }) => e.departmentId === selId)
        .map(({ e, pos }) => ({ e, pos, t: attBy.get(e.id), ot: otOf(e.id), leave: leaveBy.get(e.id) ?? 0 }))
        .sort((a, b) => (b.t?.lateMinutes ?? 0) - (a.t?.lateMinutes ?? 0) || b.ot - a.ot)
    : [];
  const topLate = [...att]
    .filter((a) => a.totals.lateCount > 0)
    .sort((a, b) => b.totals.lateMinutes - a.totals.lateMinutes)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="ภาพรวมผู้บริหาร"
        subtitle="กำลังคน ค่า OT มาสาย/ขาด และการลา แยกตามแผนก · กดที่แผนกเพื่อดูรายคน"
        actions={<StepNav prev={`?m=${ym(y, m - 1)}${sel ? `&d=${sel}` : ""}`} next={`?m=${ym(y, m + 1)}${sel ? `&d=${sel}` : ""}`} label={fmtMonth(y, m)} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="พนักงานปัจจุบัน" value={active.length} hint={`เข้าใหม่ ${hired} · ลาออก ${left} (ตั้งแต่ต้นปี)`} icon={<Icon name="people" className="size-5" />} />
        <Stat
          label="อัตราลาออก (ต้นปีถึงเดือนนี้)"
          value={`${turnover}%`}
          tone={turnover > 10 ? "bad" : turnover > 5 ? "warn" : "good"}
          icon={<Icon name="logOut" className="size-5" />}
        />
        <Stat
          label={hasPayroll ? "ค่า OT เดือนนี้" : "ชั่วโมง OT ที่อนุมัติ"}
          value={hasPayroll ? `${fmtMoney(sum("ot"))} ฿` : `${sum("ot")} ชม.`}
          hint={hasPayroll ? `${pct(sum("ot"), totalGross)}% ของรายได้รวม` : "ยังไม่ได้คำนวณงวดเงินเดือน"}
          tone="warn"
          icon={<Icon name="clock" className="size-5" />}
        />
        <Stat
          label="มาสาย / ขาดงาน"
          value={`${sum("late")} / ${sum("absent")}`}
          hint={`ขาดงาน ${pct(sum("absent"), sum("scheduled"))}% ของวันทำงาน`}
          tone={sum("absent") > 0 ? "bad" : "default"}
          icon={<Icon name="alert" className="size-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={hasPayroll ? "ค่า OT แยกแผนก (บาท)" : "ชั่วโมง OT แยกแผนก"} subtitle={fmtMonth(y, m)}>
          <BarChart data={otData} orientation="horizontal" ariaLabel="OT แยกตามแผนก" highlightLast={false} />
        </Card>
        <Card title="มาสายแยกแผนก" subtitle={`${fmtMonth(y, m)} · จำนวนครั้ง`}>
          <BarChart data={lateData} orientation="horizontal" ariaLabel="มาสายแยกตามแผนก" highlightLast={false} />
        </Card>
        <Card title="วันลาที่ใช้ไป แยกแผนก" subtitle={`ตั้งแต่ 1 ม.ค. ${y + 543}`}>
          <BarChart data={leaveData} orientation="horizontal" ariaLabel="วันลาแยกตามแผนก" highlightLast={false} />
        </Card>
        <Card title="จำนวนพนักงานแยกแผนก">
          <BarChart data={headData} orientation="horizontal" ariaLabel="พนักงานแยกตามแผนก" highlightLast={false} />
        </Card>
      </div>

      {/* รายละเอียดแผนกที่กดเลือก */}
      {sel && (
        <div id="dept" className="mt-5 scroll-mt-6">
          <Card
            title={`รายละเอียดแผนก${name(selId)}`}
            subtitle={`${members.length} คน · ${fmtMonth(y, m)} · กดที่ชื่อเพื่อดูข้อมูลคนนั้น`}
            actions={
              <Link href={`?m=${month}`} scroll={false} className="inline-flex items-center gap-1 rounded-full border border-brand-200 px-3 py-1 text-sm text-brand-700 hover:bg-brand-50">
                <Icon name="x" className="size-4" /> ปิด
              </Link>
            }
          >
            <Table head={["พนักงาน", hasPayroll ? "ค่า OT (บาท)" : "OT (ชม.)", "มาสาย", "ขาดงาน", "ลาตั้งแต่ต้นปี", ""]} empty={!members.length}>
              {members.map(({ e, pos, t, ot, leave }) => (
                <tr key={e.id} data-href={`/attendance/me?employee=${e.id}&month=${month}`}>
                  <td>
                    <Link href={`/attendance/me?employee=${e.id}&month=${month}`} className="block font-medium text-brand-900">
                      {fullName(e)}
                    </Link>
                    <span className="text-xs text-stone-500">
                      {e.code}
                      {pos ? ` · ${pos}` : ""}
                    </span>
                  </td>
                  <td className="tabular-nums">{ot ? (hasPayroll ? fmtMoney(ot) : ot) : "-"}</td>
                  <td className={cn("tabular-nums", (t?.lateCount ?? 0) > 0 && "text-amber-700")}>{t?.lateCount ? `${t.lateCount} ครั้ง · ${t.lateMinutes} นาที` : "-"}</td>
                  <td className={cn("tabular-nums", (t?.absent ?? 0) > 0 && "text-rose-700")}>{t?.absent ? `${t.absent} วัน` : "-"}</td>
                  <td className="tabular-nums">{leave ? `${leave} วัน` : "-"}</td>
                  <td className="text-right whitespace-nowrap">
                    <Link href={`/personnel/${e.id}`} className="text-sm text-brand-600 hover:text-brand-800">
                      ข้อมูลพนักงาน
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      <Card className="mt-5" title="มาสายมากที่สุด 5 อันดับ" subtitle={fmtMonth(y, m)}>
        <Table head={["พนักงาน", "แผนก", "มาสาย", "รวม (นาที)", "ขาดงาน"]} empty={!topLate.length}>
          {topLate.map((a) => (
            <tr key={a.employee.id} data-href={`/attendance/me?employee=${a.employee.id}&month=${month}`}>
              <td>
                <Link href={`/attendance/me?employee=${a.employee.id}&month=${month}`} className="font-medium text-brand-900">
                  {fullName(a.employee)}
                </Link>
              </td>
              <td className="text-stone-500">{name(a.employee.departmentId)}</td>
              <td className="tabular-nums">{a.totals.lateCount} ครั้ง</td>
              <td className="tabular-nums">{a.totals.lateMinutes}</td>
              <td className="tabular-nums">{a.totals.absent} วัน</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
