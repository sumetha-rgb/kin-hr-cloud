import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches, employeePhotos, employees, warnings } from "@/db/schema";
import { Avatar } from "@/components/avatar";
import { EmployeePicker } from "@/components/employee-picker";
import { FilterBar, FilterSelect, StepNav } from "@/components/filter-bar";
import { Icon } from "@/components/icons";
import { Badge, Card, Flash, LinkButton, PageHeader, Stat, Table } from "@/components/ui";
import { isHR, requireUser } from "@/lib/auth";
import { bkkDateStr, fmtDate } from "@/lib/time";
import { fullName } from "@/lib/util";
import { isActiveWarning, WARNING_STATUS, WARNING_TONE, warningStatus, type WarningLevel } from "@/lib/warning";
import { getWarningConfig } from "@/lib/warning-config";
import { MyWarnings } from "./my-warnings";

export const metadata = { title: "ใบเตือน" };

export default async function WarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; level?: string; category?: string; status?: string; branch?: string; employee?: string; ok?: string; error?: string }>;
}) {
  const u = await requireUser();
  const sp = await searchParams;
  if (!isHR(u)) return <MyWarnings user={u} ok={sp.ok} error={sp.error} />; // พนักงาน/หัวหน้า: เห็นเฉพาะของตัวเอง
  const today = bkkDateStr();
  const thisYear = Number(today.slice(0, 4));
  const year = Number(sp.year) || thisYear;

  const conds: SQL[] = [gte(warnings.incidentDate, `${year}-01-01`), lte(warnings.incidentDate, `${year}-12-31`)];
  if (sp.level) conds.push(eq(warnings.level, sp.level as WarningLevel));
  if (sp.category) conds.push(eq(warnings.category, sp.category));
  if (sp.branch) conds.push(eq(employees.branchId, Number(sp.branch)));
  if (sp.employee) conds.splice(0, 2, eq(warnings.employeeId, Number(sp.employee))); // ดูประวัติรายคน = ทุกปี

  const [all, br, emps] = await Promise.all([
    db
      .select({ w: warnings, e: employees, branch: branches.name, photoAt: employeePhotos.updatedAt })
      .from(warnings)
      .innerJoin(employees, eq(warnings.employeeId, employees.id))
      .leftJoin(branches, eq(employees.branchId, branches.id))
      .leftJoin(employeePhotos, eq(employeePhotos.employeeId, employees.id))
      .where(and(...conds))
      .orderBy(desc(warnings.incidentDate), desc(warnings.id)),
    db.select().from(branches).orderBy(branches.code),
    db.select().from(employees).orderBy(employees.code),
  ]);
  // ประเภทความผิด: ที่ตั้งไว้ทั้งหมด + ชื่อที่อยู่ในใบเก่าแต่ถูกเปลี่ยนชื่อไปแล้ว
  const wcfg = await getWarningConfig();
  const catNames = [...new Set([...wcfg.categories.map((c) => c.name), ...all.map((r) => r.w.category)])];
  const rows = sp.status ? all.filter((r) => warningStatus(r.w, today) === sp.status) : all;
  const valid = all.filter((r) => r.w.voidedAt === null);

  // สรุป
  const pending = valid.filter((r) => warningStatus(r.w, today) === "pending").length;
  const activeFinal = valid.filter((r) => r.w.level === "final" && isActiveWarning(r.w, today)).length;
  const byCategory = catNames.map((c) => ({ c, n: valid.filter((r) => r.w.category === c).length })).filter((x) => x.n > 0);
  const maxCat = Math.max(1, ...byCategory.map((x) => x.n));
  // รายคน: นับเฉพาะใบที่ยังมีผล
  const people = new Map<number, { e: (typeof all)[number]["e"]; photoAt: Date | null; branch: string | null; active: number; total: number; top: WarningLevel; last: string; pending: number }>();
  for (const r of valid) {
    const p = people.get(r.e.id) ?? { e: r.e, photoAt: r.photoAt, branch: r.branch, active: 0, total: 0, top: "verbal" as WarningLevel, last: r.w.incidentDate, pending: 0 };
    p.total++;
    if (isActiveWarning(r.w, today)) {
      p.active++;
      if (["verbal", "written", "final"].indexOf(r.w.level) > ["verbal", "written", "final"].indexOf(p.top)) p.top = r.w.level;
    }
    if (warningStatus(r.w, today) === "pending") p.pending++;
    if (r.w.incidentDate > p.last) p.last = r.w.incidentDate;
    people.set(r.e.id, p);
  }
  const ranked = [...people.values()].sort((a, b) => b.active - a.active || b.total - a.total);
  const focus = sp.employee ? (emps.find((e) => e.id === Number(sp.employee)) ?? null) : null;
  const picker = (
    <EmployeePicker
      key={sp.employee ?? "all"}
      variant="filter"
      syncParam="employee"
      allowClear="ดูประวัติรายคน: พิมพ์ชื่อหรือรหัส"
      placeholder="ค้นหาประวัติพนักงาน: ชื่อ ชื่อเล่น หรือรหัส"
      defaultValue={Number(sp.employee) || undefined}
      options={emps.filter((e) => e.status !== "resigned" || e.id === focus?.id).map((e) => ({ id: e.id, code: e.code, name: fullName(e), nickname: e.nickname }))}
      className="min-w-64 flex-1"
    />
  );

  return (
    <>
      <PageHeader
        title={focus ? `ใบเตือนของ ${fullName(focus)}` : "ใบเตือน"}
        subtitle={focus ? `${focus.code} · ประวัติทั้งหมด ${all.length} ใบ` : "สรุปการออกใบเตือนและประวัติวินัยของพนักงาน"}
        actions={<LinkButton href={`/warnings/new${sp.employee ? `?employee=${sp.employee}` : ""}`}>ออกใบเตือน</LinkButton>}
      />
      <Flash ok={sp.ok} error={sp.error} />

      <FilterBar className="mb-3">{picker}</FilterBar>

      {!focus && (
        <FilterBar>
          <StepNav label={`ปี ${year + 543}`} prev={`?year=${year - 1}`} next={year < thisYear ? `?year=${year + 1}` : null} />
          <FilterSelect param="level" value={sp.level ?? ""} label="ระดับ" options={wcfg.levels.map((l) => ({ value: l.level, label: l.name }))} className="min-w-40 flex-1 sm:max-w-56" />
          <FilterSelect param="category" value={sp.category ?? ""} label="ประเภทความผิด" options={catNames.map((c) => ({ value: c, label: c }))} className="min-w-44 flex-1 sm:max-w-64" />
          <FilterSelect param="branch" value={sp.branch ?? ""} label="สาขา" options={br.map((b) => ({ value: b.id, label: b.name }))} className="min-w-40 flex-1 sm:max-w-56" />
          <FilterSelect param="status" value={sp.status ?? ""} label="สถานะ" options={Object.entries(WARNING_STATUS).map(([value, v]) => ({ value, label: v.label }))} className="min-w-40 flex-1 sm:max-w-56" />
        </FilterBar>
      )}
      {focus && (
        <Link href="/warnings" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
          <Icon name="chevronLeft" className="size-4" />
          สรุปใบเตือนทั้งหมด
        </Link>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={focus ? "ใบเตือนทั้งหมด" : `ใบเตือนปี ${year + 543}`} value={valid.length} icon={<Icon name="flag" className="size-4" />} />
        <Stat label="รอพนักงานรับทราบ" value={pending} tone={pending ? "warn" : "default"} icon={<Icon name="clock" className="size-4" />} />
        <Stat label="เตือนครั้งสุดท้าย (ยังมีผล)" value={activeFinal} tone={activeFinal ? "bad" : "default"} icon={<Icon name="alert" className="size-4" />} />
        <Stat label="พนักงานที่มีใบเตือนมีผล" value={`${ranked.filter((p) => p.active > 0).length} คน`} icon={<Icon name="people" className="size-4" />} />
      </div>

      {!focus && (
        <div className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card title="พนักงานที่มีใบเตือน" subtitle="เรียงตามจำนวนใบที่ยังมีผลอยู่" padded={false}>
            {ranked.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-stone-500">ยังไม่มีใบเตือนในปีนี้</p>
            ) : (
              <ul className="divide-y divide-brand-100">
                {ranked.slice(0, 8).map((p) => (
                  <li key={p.e.id}>
                    <Link href={`/warnings?employee=${p.e.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-brand-50/60">
                      <Avatar name={fullName(p.e)} employeeId={p.e.id} version={p.photoAt?.getTime()} size={38} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate font-medium text-brand-900">{fullName(p.e)}</span>
                        <span className="block text-xs text-stone-500">
                          {p.branch ?? "-"} · ล่าสุด {fmtDate(p.last)}
                        </span>
                      </span>
                      {p.active > 0 ? <Badge tone={WARNING_TONE[p.top]}>{wcfg.level[p.top].name}</Badge> : <Badge tone="gray">พ้นกำหนดแล้ว</Badge>}
                      <span className="w-14 text-right text-sm font-semibold text-brand-900 tabular-nums">{p.active} ใบ</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="แยกตามประเภทความผิด">
            {byCategory.length === 0 ? (
              <p className="text-sm text-stone-500">ยังไม่มีข้อมูล</p>
            ) : (
              <ul className="space-y-3">
                {byCategory.map(({ c, n }) => (
                  <li key={c}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-stone-700">{c}</span>
                      <span className="font-semibold text-brand-900 tabular-nums">{n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-brand-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${(n / maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Table head={["วันที่เกิดเหตุ", "พนักงาน", "ระดับ", "ประเภท / เหตุผล", "สถานะ", ""]} empty={!rows.length}>
        {rows.map(({ w, e, branch }) => {
          const st = warningStatus(w, today);
          return (
            <tr key={w.id} data-href={`/warnings/${w.id}`} className={st === "voided" ? "opacity-60" : undefined}>
              <td>
                <span className="block font-medium text-brand-900 tabular-nums">{fmtDate(w.incidentDate)}</span>
                <span className="block text-xs font-normal text-stone-500">W-{String(w.id).padStart(5, "0")}</span>
              </td>
              <td>
                <span className="block">{fullName(e)}</span>
                <span className="block text-xs text-stone-500">
                  {e.code} · {branch ?? "-"}
                </span>
              </td>
              <td>
                <Badge tone={WARNING_TONE[w.level]}>{wcfg.level[w.level].name}</Badge>
              </td>
              <td>
                <span className="block font-medium">{w.category}</span>
                <span className="line-clamp-2 block text-xs text-stone-500">{w.reason}</span>
              </td>
              <td>
                <Badge tone={WARNING_STATUS[st].tone}>{WARNING_STATUS[st].label}</Badge>
              </td>
              <td className="w-8 text-right text-brand-400">
                <Icon name="chevronRight" className="ml-auto size-5" />
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
