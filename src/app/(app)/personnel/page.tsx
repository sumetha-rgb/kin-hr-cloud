import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches, departments, employeePhotos, employees, positions, users } from "@/db/schema";
import { Avatar } from "@/components/avatar";
import { Badge, DesktopOnly, Flash, Input, LinkButton, MobileCard, MobileList, PageHeader, Select, Table, btn } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/time";
import { fullName, ROLE_LABEL, STATUS_LABEL } from "@/lib/util";

export const metadata = { title: "พนักงาน" };

export default async function PersonnelPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branch?: string; status?: string; ok?: string; error?: string }>;
}) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const conds: SQL[] = [];
  if (sp.q) {
    const q = `%${sp.q}%`;
    conds.push(or(ilike(employees.code, q), ilike(employees.firstName, q), ilike(employees.lastName, q), ilike(employees.nickname, q))!);
  }
  if (sp.branch) conds.push(eq(employees.branchId, Number(sp.branch)));
  if (sp.status) conds.push(eq(employees.status, sp.status as "active"));

  const [rows, br] = await Promise.all([
    db
      .select({ e: employees, branch: branches.name, dept: departments.name, pos: positions.name, role: users.role, photoAt: employeePhotos.updatedAt })
      .from(employees)
      .leftJoin(employeePhotos, eq(employeePhotos.employeeId, employees.id))
      .leftJoin(branches, eq(employees.branchId, branches.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(positions, eq(employees.positionId, positions.id))
      .leftJoin(users, eq(users.employeeId, employees.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(employees.code))
      .limit(500),
    db.select().from(branches).orderBy(asc(branches.code)),
  ]);

  return (
    <>
      <PageHeader title="พนักงาน" subtitle={`ข้อมูลพนักงานทั้งหมด ${rows.length} คน`} actions={<LinkButton href="/personnel/new">+ เพิ่มพนักงาน</LinkButton>} />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_180px_auto]">
        <Input name="q" placeholder="ค้นหารหัส ชื่อ นามสกุล ชื่อเล่น" defaultValue={sp.q} />
        <Select name="branch" placeholder="ทุกสาขา" defaultValue={sp.branch ?? ""} options={br.map((b) => ({ value: b.id, label: b.name }))} />
        <Select name="status" placeholder="ทุกสถานะ" defaultValue={sp.status ?? ""} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        <button className={btn.secondary}>ค้นหา</button>
      </form>
      <MobileList empty={!rows.length}>
        {rows.map(({ e, branch, pos, photoAt }) => (
          <MobileCard key={e.id} href={`/personnel/${e.id}`}>
            <div className="flex items-center gap-3">
              <Avatar name={fullName(e)} employeeId={e.id} version={photoAt?.getTime()} size={48} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-brand-900">
                  {fullName(e)}
                  {e.nickname && <span className="font-normal text-stone-500"> ({e.nickname})</span>}
                </div>
                <div className="text-sm text-stone-600">
                  {e.code} · {pos ?? "-"}
                </div>
                <div className="text-sm text-stone-500">{branch ?? "-"}</div>
              </div>
              <Badge tone={e.status === "active" ? "green" : e.status === "probation" ? "gold" : "gray"}>{STATUS_LABEL[e.status]}</Badge>
            </div>
          </MobileCard>
        ))}
      </MobileList>
      <DesktopOnly>
        <Table head={["รหัส", "ชื่อ-สกุล", "สาขา", "แผนก / ตำแหน่ง", "เริ่มงาน", "สถานะ", "บัญชีผู้ใช้"]} empty={!rows.length}>
          {rows.map(({ e, branch, dept, pos, role, photoAt }) => (
            <tr key={e.id} data-href={`/personnel/${e.id}`}>
              <td>
                <Link href={`/personnel/${e.id}`} className="font-medium text-brand-600">
                  {e.code}
                </Link>
              </td>
              <td>
                <Link href={`/personnel/${e.id}`} className="flex items-center gap-2.5">
                  <Avatar name={fullName(e)} employeeId={e.id} version={photoAt?.getTime()} size={32} />
                  <span>
                    {fullName(e)}
                    {e.nickname && <span className="text-stone-400"> ({e.nickname})</span>}
                  </span>
                </Link>
              </td>
              <td>{branch ?? "-"}</td>
              <td>
                {dept ?? "-"}
                <div className="text-xs text-stone-400">{pos}</div>
              </td>
              <td>{fmtDate(e.startDate)}</td>
              <td>
                <Badge tone={e.status === "active" ? "green" : e.status === "probation" ? "blue" : "gray"}>{STATUS_LABEL[e.status]}</Badge>
              </td>
              <td>{role ? ROLE_LABEL[role] : <span className="text-xs text-amber-600">ยังไม่มี</span>}</td>
            </tr>
          ))}
        </Table>
      </DesktopOnly>
    </>
  );
}
