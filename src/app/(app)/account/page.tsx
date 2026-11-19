import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { db } from "@/db";
import { branches, departments, employees, positions, shifts, webauthnCredentials } from "@/db/schema";
import { Avatar } from "@/components/avatar";
import { PhotoUploader } from "@/components/photo-uploader";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Flash, Input, InfoRow, Textarea } from "@/components/ui";
import { isHR, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/payroll-run";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { fullName, ROLE_LABEL, STATUS_LABEL } from "@/lib/util";
import { changePassword, saveMyProfile } from "./actions";

export const metadata = { title: "โปรไฟล์ของฉัน" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const mgr = alias(employees, "mgr");
  const [settings, creds, [row]] = await Promise.all([
    getSettings(),
    db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, u.id)),
    u.employeeId
      ? db
          .select({ e: employees, branch: branches.name, dept: departments.name, pos: positions.name, shift: shifts.name, mgr })
          .from(employees)
          .leftJoin(branches, eq(employees.branchId, branches.id))
          .leftJoin(departments, eq(employees.departmentId, departments.id))
          .leftJoin(positions, eq(employees.positionId, positions.id))
          .leftJoin(shifts, eq(employees.shiftId, shifts.id))
          .leftJoin(mgr, eq(employees.managerId, mgr.id))
          .where(eq(employees.id, u.employeeId))
      : Promise.resolve([]),
  ]);
  const e = row?.e;
  const canEdit = settings.selfProfileEdit || isHR(u); // HR ปิดได้ที่ ดูแลระบบ → ตั้งค่าระบบ

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />

      {/* ส่วนหัวโปรไฟล์ */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-brand-200 bg-white shadow-card">
        <div className="h-28 bg-[radial-gradient(circle_at_20%_20%,#dcc4a0,transparent_55%),linear-gradient(120deg,#78593a,#2c1e0f)] sm:h-32" />
        <div className="flex flex-col items-center gap-4 px-5 pb-6 sm:flex-row sm:items-end sm:gap-6 sm:px-8">
          <div className="-mt-16 sm:-mt-14">
            {e && canEdit ? (
              <PhotoUploader employeeId={e.id} name={u.displayName} version={u.photoVersion} back="/account" size={120} />
            ) : (
              <Avatar name={u.displayName} employeeId={e?.id} version={u.photoVersion} size={120} className="shadow-md ring-4 ring-white" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
            <h1 className="text-2xl font-semibold text-brand-900">
              {e ? fullName(e) : u.displayName}
              {e?.nickname && <span className="ml-2 text-lg font-normal text-brand-600">({e.nickname})</span>}
            </h1>
            <p className="mt-0.5 text-[15px] text-brand-700">{[row?.pos, row?.dept, row?.branch].filter(Boolean).join(" · ") || ROLE_LABEL[u.role]}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {e && <Badge tone="gold">รหัส {e.code}</Badge>}
              <Badge tone="blue">{ROLE_LABEL[u.role]}</Badge>
              {e && <Badge tone={e.status === "active" ? "green" : "amber"}>{STATUS_LABEL[e.status]}</Badge>}
            </div>
            {e?.bio && <p className="mt-3 max-w-2xl text-sm whitespace-pre-line text-stone-600">{e.bio}</p>}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {e ? (
            <Card title="ข้อมูลส่วนตัว" subtitle={canEdit ? "ข้อมูลส่วนนี้คุณแก้ไขได้เอง" : "ฝ่ายบุคคลปิดการแก้ไขด้วยตนเอง — หากต้องการเปลี่ยน กรุณาติดต่อ HR"}>
              <form action={saveMyProfile}>
                <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
                <Field label="ชื่อเล่น">
                  <Input name="nickname" defaultValue={e.nickname ?? ""} maxLength={40} />
                </Field>
                <Field label="เบอร์โทร">
                  <Input name="phone" type="tel" inputMode="tel" defaultValue={e.phone ?? ""} />
                </Field>
                <Field label="อีเมล">
                  <Input name="email" type="email" defaultValue={e.email ?? ""} />
                </Field>
                <Field label="LINE ID">
                  <Input name="lineId" defaultValue={e.lineId ?? ""} autoCapitalize="none" />
                </Field>
                <Field label="ที่อยู่ปัจจุบัน" className="sm:col-span-2">
                  <Textarea name="address" rows={2} defaultValue={e.address ?? ""} />
                </Field>
                <Field label="ผู้ติดต่อกรณีฉุกเฉิน">
                  <Input name="emergencyName" placeholder="ชื่อ (ความสัมพันธ์)" defaultValue={e.emergencyName ?? ""} />
                </Field>
                <Field label="เบอร์ผู้ติดต่อฉุกเฉิน">
                  <Input name="emergencyPhone" type="tel" inputMode="tel" defaultValue={e.emergencyPhone ?? ""} />
                </Field>
                <Field label="แนะนำตัวสั้นๆ" hint="ไม่เกิน 300 ตัวอักษร · แสดงบนโปรไฟล์ของคุณ" className="sm:col-span-2">
                  <Textarea name="bio" rows={2} maxLength={300} defaultValue={e.bio ?? ""} />
                </Field>
                {canEdit && (
                  <div className="sm:col-span-2">
                    <SubmitButton>บันทึกโปรไฟล์</SubmitButton>
                  </div>
                )}
                </fieldset>
              </form>
            </Card>
          ) : (
            <Card title="บัญชีผู้ดูแลระบบ">
              <p className="text-sm text-stone-600">บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน จึงไม่มีโปรไฟล์ส่วนตัว</p>
            </Card>
          )}

          {e && (
            <Card title="ข้อมูลการทำงาน" subtitle="หากข้อมูลไม่ถูกต้อง กรุณาแจ้งฝ่ายบุคคล">
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <InfoRow label="ตำแหน่ง" value={row?.pos} />
                <InfoRow label="แผนก" value={row?.dept} />
                <InfoRow label="สาขา" value={row?.branch} />
                <InfoRow label="กะการทำงาน" value={row?.shift ?? "08:00-17:00"} />
                <InfoRow label="หัวหน้างาน" value={row?.mgr ? fullName(row.mgr) : "ฝ่ายบุคคล"} />
                <InfoRow label="วันเริ่มงาน" value={fmtDate(e.startDate)} />
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="ความปลอดภัย" subtitle={`ชื่อผู้ใช้ ${u.username}`}>
            <form action={changePassword} className="space-y-3">
              <Field label="รหัสผ่านปัจจุบัน">
                <Input name="current" type="password" autoComplete="current-password" required />
              </Field>
              <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร">
                <Input name="next" type="password" autoComplete="new-password" minLength={8} required />
              </Field>
              <Field label="ยืนยันรหัสผ่านใหม่">
                <Input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
              </Field>
              <SubmitButton variant="secondary">เปลี่ยนรหัสผ่าน</SubmitButton>
            </form>
          </Card>

          {u.employeeId && (
            <Card title="อุปกรณ์สแกนนิ้ว / Face ID">
              {creds.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-4 text-center text-sm text-brand-800">
                  ยังไม่ได้ลงทะเบียนมือถือ
                  <Link href="/checkin" className="mt-2 block font-medium text-brand-600 underline underline-offset-4">
                    ลงทะเบียนบนมือถือของคุณ ›
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {creds.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-brand-900">{c.deviceName || "มือถือ"}</span>
                        <span className="block text-xs text-stone-500">ใช้ล่าสุด {fmtDateTime(c.lastUsedAt)}</span>
                      </span>
                      <Badge tone="green">ใช้งานได้</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-stone-500">ลงทะเบียนได้ 1 เครื่อง หากเปลี่ยนมือถือ กรุณาแจ้ง HR เพื่อรีเซ็ตก่อน</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
