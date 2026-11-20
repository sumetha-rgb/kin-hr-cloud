import { and, asc, count, eq, ilike, isNull, ne, or, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { employeePhotos, employees, users, webauthnCredentials } from "@/db/schema";
import { lockedUsernames } from "@/lib/lockout";
import { Avatar } from "@/components/avatar";
import { FilterBar, FilterSelect } from "@/components/filter-bar";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icons";
import { Badge, DesktopOnly, Flash, MobileCard, MobileList, MoreLink, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { fullName, ROLE_LABEL } from "@/lib/util";
import { setUserActive, unlockUser } from "../actions";
import { SearchBox } from "./search-box";

export const metadata = { title: "ดูแลระบบ · บัญชีผู้ใช้" };

const FILTERS = [
  { value: "locked", label: "ถูกล็อกชั่วคราว" },
  { value: "no_device", label: "ยังไม่ลงทะเบียนมือถือ" },
  { value: "never", label: "ยังไม่เคยเข้าระบบ" },
  { value: "disabled", label: "ถูกระงับ" },
  { value: "no_account", label: "พนักงานที่ยังไม่มีบัญชี" },
];

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; filter?: string; ok?: string; error?: string }> }) {
  const me = await requireRole("admin", "hr");
  const sp = await searchParams;
  const back = `/admin/users?${new URLSearchParams(Object.entries({ q: sp.q, role: sp.role, filter: sp.filter }).filter(([, v]) => v) as [string, string][]).toString()}`;

  const locked = await lockedUsernames();

  if (sp.filter === "no_account") return <NoAccount q={sp.q} />;

  const conds: SQL[] = [];
  if (sp.q) {
    const q = `%${sp.q}%`;
    conds.push(or(ilike(users.username, q), ilike(employees.firstName, q), ilike(employees.lastName, q), ilike(employees.code, q), ilike(employees.nickname, q))!);
  }
  if (sp.role) conds.push(eq(users.role, sp.role as "hr"));
  if (sp.filter === "never") conds.push(isNull(users.lastLoginAt), eq(users.active, true));
  if (sp.filter === "disabled") conds.push(eq(users.active, false));

  const devices = db
    .select({ userId: webauthnCredentials.userId, n: count().as("n") })
    .from(webauthnCredentials)
    .groupBy(webauthnCredentials.userId)
    .as("dev");
  let rows = await db
    .select({ u: users, e: employees, photoAt: employeePhotos.updatedAt, devices: devices.n })
    .from(users)
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .leftJoin(employeePhotos, eq(employeePhotos.employeeId, employees.id))
    .leftJoin(devices, eq(devices.userId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(users.username))
    .limit(500);
  if (sp.filter === "locked") rows = rows.filter((r) => locked.has(r.u.username));
  // ชื่อที่ถูกล็อกแต่ไม่มีบัญชีจริง (มีคนพยายามเดาชื่อผู้ใช้) — แสดงแยกให้ปลดล็อก/รับรู้ได้
  const strayLocked = [...locked].filter((name) => !rows.some((r) => r.u.username === name));
  if (sp.filter === "no_device") rows = rows.filter((r) => r.e && r.e.status !== "resigned" && !r.devices);

  const name = (r: (typeof rows)[number]) => (r.e ? fullName(r.e) : r.u.username);
  const Actions = ({ r }: { r: (typeof rows)[number] }) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      {locked.has(r.u.username) && (
        <form action={unlockUser}>
          <input type="hidden" name="username" value={r.u.username} />
          <input type="hidden" name="back" value={back} />
          <SubmitButton variant="success" className="min-h-9! px-3! text-xs!">
            ปลดล็อก
          </SubmitButton>
        </form>
      )}
      {r.u.id !== me.id && !(r.u.role === "admin" && me.role !== "admin") && (
        <form action={setUserActive}>
          <input type="hidden" name="userId" value={r.u.id} />
          <input type="hidden" name="active" value={r.u.active ? "0" : "1"} />
          <input type="hidden" name="back" value={back} />
          <SubmitButton
            variant={r.u.active ? "secondary" : "success"}
            className="min-h-9! px-3! text-xs!"
            confirm={r.u.active ? `ระงับบัญชี ${r.u.username}? ผู้ใช้จะออกจากระบบทันทีและเข้าใช้ไม่ได้จนกว่าจะเปิดใหม่` : undefined}
          >
            {r.u.active ? "ระงับ" : "เปิดใช้งาน"}
          </SubmitButton>
        </form>
      )}
      {r.e && (
        <Link href={`/personnel/${r.e.id}`} className="inline-flex min-h-9 items-center gap-0.5 rounded-full border border-brand-200 bg-white pr-2 pl-3 text-xs font-medium text-brand-800 hover:bg-brand-50">
          แก้ไข
          <Icon name="chevronRight" className="size-3.5" />
        </Link>
      )}
    </div>
  );
  const Status = ({ r }: { r: (typeof rows)[number] }) =>
    !r.u.active ? <Badge tone="gray">ถูกระงับ</Badge> : locked.has(r.u.username) ? <Badge tone="red">ถูกล็อก 15 นาที</Badge> : <Badge tone="green">ใช้งานได้</Badge>;

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <FilterBar>
        <SearchBox value={sp.q ?? ""} placeholder="ค้นหาชื่อ / รหัส / username" />
        <FilterSelect param="role" value={sp.role ?? ""} label="สิทธิ์" options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} className="min-w-36 flex-1 sm:flex-none" />
        <FilterSelect param="filter" value={sp.filter ?? ""} label="สถานะบัญชี" options={FILTERS} className="min-w-52 flex-1 sm:flex-none" />
        <span className="ml-auto hidden px-3 text-sm text-stone-500 md:inline">{rows.length} บัญชี</span>
      </FilterBar>

      {sp.filter === "locked" && strayLocked.length > 0 && (
        <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50/60 p-4">
          <p className="text-sm font-medium text-rose-800">ชื่อผู้ใช้ที่ไม่มีอยู่ในระบบแต่ถูกลองเข้าสู่ระบบผิดหลายครั้ง (อาจมีคนพยายามเดารหัส)</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {strayLocked.map((name) => (
              <li key={name} className="flex items-center gap-2 rounded-full border border-rose-200 bg-white py-1 pr-1 pl-3 text-sm">
                <span className="font-mono">{name}</span>
                <form action={unlockUser}>
                  <input type="hidden" name="username" value={name} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton variant="secondary" className="min-h-8! px-3! text-xs!">
                    ปลดล็อก
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MobileList empty={!rows.length}>
        {rows.map((r) => (
          <MobileCard key={r.u.id}>
            <div className="flex items-center gap-3">
              <Avatar name={name(r)} employeeId={r.e?.id} version={r.photoAt?.getTime()} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-brand-900">{name(r)}</div>
                <div className="text-sm text-stone-500">
                  {r.u.username} · {ROLE_LABEL[r.u.role]}
                </div>
              </div>
              <Status r={r} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-stone-500">
              <span>
                มือถือ {r.devices ? `${r.devices} เครื่อง` : "ยังไม่ลงทะเบียน"} · เข้าล่าสุด {r.u.lastLoginAt ? fmtDateTime(r.u.lastLoginAt) : "ยังไม่เคย"}
              </span>
            </div>
            <div className="mt-3">
              <Actions r={r} />
            </div>
          </MobileCard>
        ))}
      </MobileList>
      <DesktopOnly>
        <Table head={["ผู้ใช้", "Username", "สิทธิ์", "มือถือสแกนนิ้ว", "เข้าระบบล่าสุด", "สถานะ", ""]} empty={!rows.length}>
          {rows.map((r) => (
            <tr key={r.u.id} data-href={r.e ? `/personnel/${r.e.id}` : undefined}>
              <td>
                <span className="flex items-center gap-2.5">
                  <Avatar name={name(r)} employeeId={r.e?.id} version={r.photoAt?.getTime()} size={34} />
                  <span className="leading-tight">
                    <span className="block font-medium text-brand-900">{name(r)}</span>
                    {r.e && <span className="text-xs text-stone-400">{r.e.code}</span>}
                  </span>
                </span>
              </td>
              <td className="font-mono text-xs">{r.u.username}</td>
              <td>
                <Badge tone={r.u.role === "admin" ? "red" : r.u.role === "hr" ? "gold" : r.u.role === "manager" ? "blue" : "gray"}>{ROLE_LABEL[r.u.role]}</Badge>
              </td>
              <td>{r.devices ? <Badge tone="green">{r.devices} เครื่อง</Badge> : r.e ? <span className="text-xs text-amber-700">ยังไม่ลงทะเบียน</span> : "-"}</td>
              <td className="text-sm whitespace-nowrap">{r.u.lastLoginAt ? fmtDateTime(r.u.lastLoginAt) : <span className="text-stone-400">ยังไม่เคย</span>}</td>
              <td>
                <Status r={r} />
              </td>
              <td>
                <Actions r={r} />
              </td>
            </tr>
          ))}
        </Table>
      </DesktopOnly>
    </>
  );
}

/** พนักงาน (ยังไม่ลาออก) ที่ยังไม่มีบัญชีเข้าใช้งาน */
async function NoAccount({ q }: { q?: string }) {
  const rows = await db
    .select({ e: employees })
    .from(employees)
    .leftJoin(users, eq(users.employeeId, employees.id))
    .where(and(ne(employees.status, "resigned"), isNull(users.id), q ? or(ilike(employees.firstName, `%${q}%`), ilike(employees.code, `%${q}%`)) : undefined))
    .orderBy(asc(employees.code));
  return (
    <>
      <FilterBar>
        <SearchBox value={q ?? ""} placeholder="ค้นหาชื่อ / รหัส" />
        <FilterSelect param="filter" value="no_account" label="สถานะบัญชี" options={FILTERS} className="min-w-52 flex-1 sm:flex-none" />
        <span className="ml-auto hidden px-3 text-sm text-stone-500 md:inline">{rows.length} คน</span>
      </FilterBar>
      <Table head={["รหัส", "พนักงาน", ""]} empty={!rows.length}>
        {rows.map(({ e }) => (
          <tr key={e.id} data-href={`/personnel/${e.id}`}>
            <td>{e.code}</td>
            <td>{fullName(e)}</td>
            <td className="text-right">
              <MoreLink href={`/personnel/${e.id}`}>สร้างบัญชี</MoreLink>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
