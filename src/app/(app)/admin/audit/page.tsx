import { and, asc, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, employees, users } from "@/db/schema";
import { EmployeePicker } from "@/components/employee-picker";
import { fullName } from "@/lib/util";
import { DateRangeNav, FilterBar, FilterSelect } from "@/components/filter-bar";
import { Badge, DesktopOnly, MobileCard, MobileList, Table } from "@/components/ui";
import { AUDIT_ACTION, AUDIT_ENTITY, auditTone } from "@/lib/audit-labels";
import { parseRange } from "@/lib/range";
import { addDays, atBkk, bkkTimeStr, fmtDate } from "@/lib/time";

export const metadata = { title: "ดูแลระบบ · ประวัติการใช้งาน" };

const LIMIT = 500;

/** สรุปรายละเอียดสั้น ๆ จาก detail (jsonb) — ไม่แสดงข้อมูลอ่อนไหวอย่างรหัสผ่าน */
function summarize(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const skip = new Set(["password", "passwordHash", "publicKey", "credentialId", "updatedAt"]);
  return Object.entries(detail as Record<string, unknown>)
    .filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && v !== "" && typeof v !== "object")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === "boolean" ? (v ? "ใช่" : "ไม่") : String(v)}`)
    .join(" · ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ date?: string; from?: string; to?: string; action?: string; user?: string }> }) {
  const sp = await searchParams;
  // ไม่ระบุวัน = 7 วันล่าสุด
  const today = parseRange({}).today;
  const r = parseRange(sp.date || sp.from ? sp : { from: addDays(today, -6), to: today }, 92);

  const conds: SQL[] = [gte(auditLogs.createdAt, atBkk(r.from)), lt(auditLogs.createdAt, atBkk(addDays(r.to, 1)))];
  if (sp.action) conds.push(eq(auditLogs.action, sp.action));
  if (sp.user) conds.push(eq(auditLogs.userId, Number(sp.user)));

  const [rows, people, actions] = await Promise.all([
    db
      .select({ a: auditLogs, username: users.username })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conds))
      .orderBy(desc(auditLogs.createdAt))
      .limit(LIMIT),
    db
      .select({ id: users.id, username: users.username, e: employees })
      .from(users)
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .orderBy(asc(users.username)),
    db.selectDistinct({ action: auditLogs.action }).from(auditLogs).orderBy(asc(auditLogs.action)),
  ]);

  const who = (x: (typeof rows)[number]) => x.username ?? (x.a.action.startsWith("login") ? `(${x.a.entityId ?? "?"})` : "ระบบ");
  const what = (x: (typeof rows)[number]) => {
    const ent = AUDIT_ENTITY[x.a.entity] ?? x.a.entity;
    return x.a.entity === "user" || !x.a.entityId ? ent + (x.a.entity === "user" && x.a.entityId ? ` ${x.a.entityId}` : "") : `${ent} #${x.a.entityId}`;
  };

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
          defaultIsToday={false}
        />
        <FilterSelect
          param="action"
          value={sp.action ?? ""}
          label="การกระทำ"
          options={actions.map((x) => ({ value: x.action, label: AUDIT_ACTION[x.action] ?? x.action }))}
          className="min-w-44 flex-1 sm:flex-none"
        />
        <EmployeePicker
          key={sp.user ?? "all"}
          variant="filter"
          syncParam="user"
          allowClear="ผู้ใช้: ทั้งหมด"
          placeholder="พิมพ์ชื่อหรือ username"
          defaultValue={Number(sp.user) || undefined}
          options={people.map((p) => ({ id: p.id, code: p.username, name: p.e ? fullName(p.e) : p.username, nickname: p.e?.nickname }))}
          className="min-w-56 flex-1 sm:max-w-72"
        />
        <span className="ml-auto hidden px-3 text-sm text-stone-500 md:inline">
          {rows.length}
          {rows.length === LIMIT ? "+" : ""} รายการ
        </span>
      </FilterBar>
      {rows.length === LIMIT && <p className="mb-3 text-sm text-amber-700">แสดง {LIMIT} รายการล่าสุด — เลือกช่วงวันหรือตัวกรองให้แคบลงเพื่อดูรายการที่เก่ากว่า</p>}

      <MobileList empty={!rows.length}>
        {rows.map((x) => (
          <MobileCard key={x.a.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Badge tone={auditTone(x.a.action)}>{AUDIT_ACTION[x.a.action] ?? x.a.action}</Badge>
                <div className="mt-1.5 text-[15px] font-medium text-brand-900">{what(x)}</div>
                <div className="text-sm text-stone-500">โดย {who(x)}</div>
              </div>
              <div className="shrink-0 text-right text-xs text-stone-500 tabular-nums">
                {fmtDate(x.a.createdAt)}
                <div className="text-sm font-semibold text-brand-900">{bkkTimeStr(x.a.createdAt)}</div>
              </div>
            </div>
            {summarize(x.a.detail) && <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-xs break-words text-stone-600">{summarize(x.a.detail)}</p>}
          </MobileCard>
        ))}
      </MobileList>
      <DesktopOnly>
        <Table head={["เวลา", "ผู้ใช้", "การกระทำ", "รายการ", "รายละเอียด"]} empty={!rows.length}>
          {rows.map((x) => (
            <tr key={x.a.id}>
              <td className="whitespace-nowrap tabular-nums">
                <span className="mr-1.5 text-xs text-stone-500">{fmtDate(x.a.createdAt)}</span>
                {bkkTimeStr(x.a.createdAt)}
              </td>
              <td className="font-mono text-xs">{who(x)}</td>
              <td>
                <Badge tone={auditTone(x.a.action)}>{AUDIT_ACTION[x.a.action] ?? x.a.action}</Badge>
              </td>
              <td>{what(x)}</td>
              <td className="w-full max-w-0 truncate text-xs text-stone-500" title={summarize(x.a.detail)}>
                {summarize(x.a.detail) || "-"}
              </td>
            </tr>
          ))}
        </Table>
      </DesktopOnly>
    </>
  );
}
