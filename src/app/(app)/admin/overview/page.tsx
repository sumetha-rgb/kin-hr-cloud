import { and, count, countDistinct, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { auditLogs, branches, employeePhotos, employees, holidays, users, webauthnCredentials } from "@/db/schema";
import { Icon } from "@/components/icons";
import { Card, Stat } from "@/components/ui";
import { lockedUsernames, LOCK_MAX, LOCK_MIN } from "@/lib/lockout";
import { getSettings } from "@/lib/payroll-run";
import { bkkDateStr, fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/util";

export const metadata = { title: "ดูแลระบบ · ภาพรวม" };

type Check = { ok: boolean; level: "danger" | "warn" | "info"; title: string; detail: string; href?: string; cta?: string };

export default async function AdminOverview() {
  const year = Number(bkkDateStr().slice(0, 4));
  const dayAgo = new Date(Date.now() - 86_400_000);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const active = ne(employees.status, "resigned");

  const [
    s,
    [{ n: empCount }],
    [{ n: noAccount }],
    [{ n: userCount }],
    [{ n: neverLogin }],
    [{ n: withDevice }],
    [{ n: withPhoto }],
    [{ n: noGeo }],
    [{ n: holidayCount }],
    [{ n: noManager }],
    [{ n: failed24 }],
    lockedRows,
    [{ n: active7 }],
    [last],
  ] = await Promise.all([
    getSettings(),
    db.select({ n: count() }).from(employees).where(active),
    db.select({ n: count() }).from(employees).leftJoin(users, eq(users.employeeId, employees.id)).where(and(active, isNull(users.id))),
    db.select({ n: count() }).from(users).where(eq(users.active, true)),
    db.select({ n: count() }).from(users).where(and(eq(users.active, true), isNull(users.lastLoginAt))),
    db
      .select({ n: countDistinct(users.employeeId) })
      .from(webauthnCredentials)
      .innerJoin(users, eq(webauthnCredentials.userId, users.id))
      .innerJoin(employees, eq(users.employeeId, employees.id))
      .where(active),
    db.select({ n: count() }).from(employeePhotos).innerJoin(employees, eq(employeePhotos.employeeId, employees.id)).where(active),
    db.select({ n: count() }).from(branches).where(and(eq(branches.active, true), isNull(branches.latitude))),
    db.select({ n: count() }).from(holidays).where(and(gte(holidays.date, `${year}-01-01`), sql`${holidays.date} <= ${`${year}-12-31`}`)),
    db.select({ n: count() }).from(employees).where(and(active, isNull(employees.managerId))),
    db.select({ n: count() }).from(auditLogs).where(and(eq(auditLogs.action, "login_failed"), gte(auditLogs.createdAt, dayAgo))),
    lockedUsernames().then((s) => [...s]),
    db.select({ n: countDistinct(auditLogs.userId) }).from(auditLogs).where(and(eq(auditLogs.action, "login"), gte(auditLogs.createdAt, weekAgo))),
    db.select({ at: auditLogs.createdAt }).from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(1),
  ]);

  const noDevice = Math.max(0, empCount - withDevice);
  const checks: Check[] = [
    {
      ok: !s.demoLogin,
      level: "danger",
      title: s.demoLogin ? "ปุ่มบัญชีทดลองยังเปิดอยู่ที่หน้าเข้าสู่ระบบ" : "ปิดปุ่มบัญชีทดลองแล้ว",
      detail: "ใครเปิดเว็บก็กดเข้าเป็น HR ได้ทันที — ต้องปิดก่อนใส่ข้อมูลพนักงานจริง",
      href: "/admin/settings",
      cta: "ไปปิด",
    },
    {
      ok: lockedRows.length === 0,
      level: "danger",
      title: lockedRows.length ? `มี ${lockedRows.length} บัญชีถูกล็อกชั่วคราว (ใส่รหัสผิดเกิน ${LOCK_MAX} ครั้ง)` : "ไม่มีบัญชีถูกล็อก",
      detail: lockedRows.length ? lockedRows.join(", ") : `ระบบล็อกอัตโนมัติ ${LOCK_MIN} นาทีเมื่อใส่รหัสผิด ${LOCK_MAX} ครั้ง`,
      href: "/admin/users?filter=locked",
      cta: "ดู / ปลดล็อก",
    },
    {
      ok: noGeo === 0,
      level: "warn",
      title: noGeo ? `${noGeo} สาขายังไม่ได้ตั้งพิกัด` : "ทุกสาขาตั้งพิกัดลงเวลาแล้ว",
      detail: "พนักงานจะสแกนลงเวลาที่สาขาไม่ได้จนกว่าจะตั้งพิกัด (ไปที่สาขาแล้วกด “ใช้ตำแหน่งปัจจุบัน”)",
      href: "/organization/branches",
      cta: "ตั้งพิกัด",
    },
    {
      ok: noAccount === 0,
      level: "warn",
      title: noAccount ? `พนักงาน ${noAccount} คนยังไม่มีบัญชีเข้าใช้งาน` : "พนักงานทุกคนมีบัญชีแล้ว",
      detail: "สร้างบัญชีได้ที่หน้าพนักงานแต่ละคน → การ์ด “บัญชีเข้าใช้งาน”",
      href: "/admin/users?filter=no_account",
      cta: "ดูรายชื่อ",
    },
    {
      ok: noDevice === 0,
      level: "warn",
      title: noDevice ? `พนักงาน ${noDevice} คนยังไม่ได้ลงทะเบียนมือถือสแกนนิ้ว` : "ทุกคนลงทะเบียนมือถือแล้ว",
      detail: "ให้พนักงานเข้าสู่ระบบบนมือถือของตัวเอง → เมนู “สแกนนิ้วลงเวลา” → ลงทะเบียน",
      href: "/admin/users?filter=no_device",
      cta: "ดูรายชื่อ",
    },
    {
      ok: holidayCount >= 13,
      level: "warn",
      title: `วันหยุดประจำปี ${year + 543}: ${holidayCount} วัน`,
      detail: "กฎหมายแรงงานกำหนดไม่น้อยกว่า 13 วัน/ปี (รวมวันแรงงาน)",
      href: `/organization/holidays?year=${year}`,
      cta: "จัดการวันหยุด",
    },
    {
      ok: neverLogin === 0,
      level: "info",
      title: neverLogin ? `${neverLogin} บัญชียังไม่เคยเข้าสู่ระบบ` : "ทุกบัญชีเคยเข้าสู่ระบบแล้ว",
      detail: "อาจยังไม่ได้แจ้งรหัสผ่านให้พนักงาน",
      href: "/admin/users?filter=never",
      cta: "ดูรายชื่อ",
    },
    {
      ok: noManager === 0,
      level: "info",
      title: noManager ? `พนักงาน ${noManager} คนไม่มีหัวหน้างาน` : "พนักงานทุกคนมีหัวหน้างาน",
      detail: "คำขอลา/OT ของคนกลุ่มนี้จะส่งให้ HR อนุมัติแทน",
      href: "/personnel",
      cta: "กำหนดหัวหน้า",
    },
  ];
  const todo = checks.filter((c) => !c.ok);
  const done = checks.filter((c) => c.ok);
  const pct = Math.round((done.length / checks.length) * 100);

  // ฐานข้อมูลที่ใช้อยู่ (ไม่แสดงรหัสผ่าน)
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "";
    }
  })();
  const region = host.match(/\.([a-z]{2}-[a-z]+-\d)\.aws/)?.[1] ?? "-";
  const regionName: Record<string, string> = { "ap-southeast-1": "สิงคโปร์", "us-east-2": "โอไฮโอ สหรัฐฯ", "us-east-1": "เวอร์จิเนีย สหรัฐฯ" };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="บัญชีที่ใช้งานได้" value={userCount} hint={`พนักงาน ${empCount} คน`} icon={<Icon name="user" className="size-4" />} />
        <Stat label="ลงทะเบียนมือถือแล้ว" value={`${withDevice}/${empCount}`} tone={noDevice ? "warn" : "good"} icon={<Icon name="finger" className="size-4" />} />
        <Stat label="เข้าใช้งานใน 7 วัน" value={`${active7} คน`} tone="good" icon={<Icon name="chart" className="size-4" />} />
        <Stat label="เข้าระบบไม่สำเร็จ 24 ชม." value={failed24} tone={failed24 > 10 ? "bad" : "default"} hint="นับทุกความพยายาม" icon={<Icon name="clock" className="size-4" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card
          title="ความพร้อมก่อนใช้งานจริง"
          subtitle={todo.length ? `เหลือ ${todo.length} รายการที่ควรจัดการ` : "เรียบร้อยครบทุกข้อ"}
          actions={<span className="text-sm font-semibold text-brand-700 tabular-nums">{pct}%</span>}
        >
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-brand-100">
            <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-gradient-to-r from-brand-400 to-brand-600")} style={{ width: `${pct}%` }} />
          </div>
          <ul className="space-y-2.5">
            {[...todo, ...done].map((c) => (
              <li
                key={c.title}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3.5",
                  c.ok ? "border-emerald-100 bg-emerald-50/40" : c.level === "danger" ? "border-rose-200 bg-rose-50/60" : c.level === "warn" ? "border-amber-200 bg-amber-50/60" : "border-brand-200 bg-brand-50/50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                    c.ok ? "bg-emerald-500" : c.level === "danger" ? "bg-rose-500" : c.level === "warn" ? "bg-amber-500" : "bg-brand-400",
                  )}
                >
                  <Icon name={c.ok ? "tick" : "alert"} className="size-3.5" strokeWidth={c.ok ? 3 : 2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] font-medium sm:text-sm", c.ok ? "text-emerald-800" : "text-brand-900")}>{c.title}</span>
                  {!c.ok && <span className="mt-0.5 block text-sm text-stone-600">{c.detail}</span>}
                </span>
                {!c.ok && c.href && (
                  <Link href={c.href} className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-brand-200 bg-white py-1.5 pr-2 pl-3 text-sm font-medium text-brand-800 shadow-sm hover:bg-brand-50">
                    {c.cta}
                    <Icon name="chevronRight" className="size-4" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card title="ข้อมูลระบบ">
            <dl className="space-y-2.5 text-sm">
              {[
                ["ฐานข้อมูล", <span key="db" className="font-mono text-xs">{host.split(".")[0]?.replace("-pooler", "") || "-"}</span>],
                ["ที่ตั้งเซิร์ฟเวอร์ข้อมูล", `${regionName[region] ?? region}`],
                ["โดเมนสแกนนิ้ว (RP ID)", process.env.WEBAUTHN_RP_ID || "อัตโนมัติตามโดเมนที่เปิด"],
                ["รูปโปรไฟล์", `${withPhoto}/${empCount} คน`],
                ["กิจกรรมล่าสุด", last ? fmtDateTime(last.at) : "-"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-baseline justify-between gap-3 border-b border-brand-100 pb-2.5 last:border-0 last:pb-0">
                  <dt className="text-stone-500">{k}</dt>
                  <dd className="text-right font-medium text-brand-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="ทางลัด">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["/personnel/new", "+ เพิ่มพนักงาน"],
                ["/organization/branches", "สาขา / พิกัด"],
                ["/organization/shifts", "กะการทำงาน"],
                ["/organization/leave-types", "ประเภทการลา"],
                ["/organization/settings", "ตั้งค่าบริษัท / ประกันสังคม"],
                ["/admin/audit?action=login_failed", "ดูการเข้าระบบที่ผิดพลาด"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="rounded-2xl border border-brand-200 bg-white px-3 py-2.5 font-medium text-brand-800 transition hover:border-brand-300 hover:bg-brand-50">
                  {label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
