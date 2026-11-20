import { asc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { departments, employeeLicenses, employees } from "@/db/schema";
import { EmployeePicker } from "@/components/employee-picker";
import { FilterBar, FilterSelect } from "@/components/filter-bar";
import { Badge, Card, Flash, PageHeader, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { licenseStatus } from "@/lib/license";
import { fmtDate } from "@/lib/time";
import { fullName } from "@/lib/util";
import { LicenseForm } from "./license-ui";

export const metadata = { title: "ใบอนุญาต / ใบรับรอง" };

const FILTERS = [
  { value: "due", label: "หมดอายุ / ใกล้หมด (60 วัน)" },
  { value: "expired", label: "หมดอายุแล้ว" },
  { value: "all", label: "ทั้งหมด" },
];

export default async function LicensesPage({ searchParams }: { searchParams: Promise<{ show?: string; ok?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const show = sp.show ?? "due";
  const [rows, emps] = await Promise.all([
    db
      .select({ l: employeeLicenses, e: employees, dept: departments.name })
      .from(employeeLicenses)
      .innerJoin(employees, eq(employeeLicenses.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(ne(employees.status, "resigned"))
      .orderBy(asc(employeeLicenses.expiresAt), asc(employees.code)),
    db.select().from(employees).where(ne(employees.status, "resigned")).orderBy(asc(employees.code)),
  ]);
  const withStatus = rows.map((x) => ({ ...x, st: licenseStatus(x.l.expiresAt) }));
  const shown = withStatus.filter(({ st }) => (show === "all" ? true : show === "expired" ? st.key === "expired" : ["expired", "urgent", "soon"].includes(st.key)));
  const count = (k: string[]) => withStatus.filter(({ st }) => k.includes(st.key)).length;

  return (
    <>
      <PageHeader title="ใบอนุญาต / ใบรับรอง" subtitle="ใบประกอบวิชาชีพ CPR การอบรม — ระบบแจ้งเตือนพนักงานและ HR ก่อนหมดอายุ 60 / 30 / 7 วัน" />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          ["หมดอายุแล้ว", count(["expired"]), "text-rose-700"],
          ["เหลือไม่เกิน 60 วัน", count(["urgent", "soon"]), "text-amber-700"],
          ["ทั้งหมด", withStatus.length, "text-brand-900"],
        ].map(([k, v, c]) => (
          <div key={String(k)} className="rounded-3xl border border-brand-200/80 bg-white p-4 shadow-card">
            <p className="text-sm text-stone-500">{k}</p>
            <p className={`mt-0.5 text-[26px] font-semibold tabular-nums ${c}`}>{v}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div>
          <FilterBar>
            <FilterSelect param="show" value={show === "due" ? "" : show} label="แสดง" placeholder={FILTERS[0].label} options={FILTERS.slice(1)} className="min-w-56" />
          </FilterBar>
          <Table head={["พนักงาน", "ใบอนุญาต", "หมดอายุ", "สถานะ"]} empty={!shown.length}>
            {shown.map(({ l, e, dept, st }) => (
              <tr key={l.id} data-href={`/personnel/${e.id}#licenses`}>
                <td>
                  <Link href={`/personnel/${e.id}#licenses`} className="block font-medium text-brand-900">
                    {fullName(e)}
                  </Link>
                  <span className="text-xs text-stone-500">
                    {e.code}
                    {dept ? ` · ${dept}` : ""}
                  </span>
                </td>
                <td>
                  {l.name}
                  {l.licenseNo && <span className="block text-xs text-stone-500">เลขที่ {l.licenseNo}</span>}
                </td>
                <td className="whitespace-nowrap">{l.expiresAt ? fmtDate(l.expiresAt) : "-"}</td>
                <td>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </div>
        <Card title="เพิ่มใบอนุญาต">
          <LicenseForm
            back="/personnel/licenses"
            picker={
              <>
                <span className="mb-1 block text-sm font-medium text-brand-800">พนักงาน</span>
                <EmployeePicker name="employeeId" options={emps.map((e) => ({ id: e.id, code: e.code, name: fullName(e), nickname: e.nickname }))} />
              </>
            }
          />
        </Card>
      </div>
    </>
  );
}
