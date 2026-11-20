/* eslint-disable @next/next/no-img-element */
import { and, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { branches, employees, positions, users, warnings } from "@/db/schema";
import { Icon } from "@/components/icons";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Flash, Textarea } from "@/components/ui";
import { isHR, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/payroll-run";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { cn, fullName } from "@/lib/util";
import { validUntil, WARNING_LEVEL, WARNING_STATUS, warningStatus } from "@/lib/warning";
import { acknowledgeWarning, voidWarning } from "../actions";

export const metadata = { title: "ใบเตือน" };

export default async function WarningPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  const hr = isHR(u);
  const id = Number((await params).id);
  const sp = await searchParams;
  const issuer = alias(employees, "issuer");
  const [row] = await db
    .select({ w: warnings, e: employees, pos: positions.name, branch: branches.name, issuerUser: users.username, issuer })
    .from(warnings)
    .innerJoin(employees, eq(warnings.employeeId, employees.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .leftJoin(users, eq(warnings.issuedBy, users.id))
    .leftJoin(issuer, eq(users.employeeId, issuer.id))
    .where(eq(warnings.id, id));
  // พนักงานเห็นเฉพาะใบเตือนของตัวเอง
  if (!row || (!hr && row.w.employeeId !== u.employeeId)) notFound();
  const { w, e } = row;
  const [company, count] = await Promise.all([
    getSettings(),
    db.$count(warnings, and(eq(warnings.employeeId, e.id), ne(warnings.id, w.id))),
  ]);
  const status = warningStatus(w);
  const mine = w.employeeId === u.employeeId;
  const lv = WARNING_LEVEL[w.level];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={hr ? `/warnings?employee=${e.id}` : "/account#warnings"} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
          <Icon name="chevronLeft" className="size-4" />
          {hr ? "ใบเตือนทั้งหมดของพนักงานคนนี้" : "โปรไฟล์ของฉัน"}
        </Link>
        <PrintButton />
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <article className={cn("overflow-hidden rounded-3xl border bg-white shadow-card print:rounded-none print:border-0 print:shadow-none", status === "voided" ? "border-stone-300" : "border-brand-200/80")}>
        {/* หัวเอกสาร */}
        <header className="flex flex-col gap-4 border-b border-brand-100 px-6 pt-6 pb-5 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-brand-200">
              <img src="/kin-logo.png" alt="" width={40} height={40} />
            </span>
            <div>
              <p className="font-semibold leading-snug text-brand-900">{company.name}</p>
              {company.address && <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{company.address}</p>}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-xs text-stone-500">เลขที่ W-{String(w.id).padStart(5, "0")}</p>
            <p className="text-sm text-stone-600">ออกเมื่อ {fmtDate(w.issuedAt)}</p>
            <span className="mt-1 inline-block">
              <Badge tone={WARNING_STATUS[status].tone}>{WARNING_STATUS[status].label}</Badge>
            </span>
          </div>
        </header>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          <div className="text-center">
            <p className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold", w.level === "final" ? "bg-rose-50 text-rose-700" : w.level === "written" ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-800")}>
              <Icon name="flag" className="size-4" />
              {lv.label}
            </p>
            {status === "voided" && <p className="mt-2 text-sm font-medium text-stone-500">ใบเตือนนี้ถูกยกเลิกแล้ว — {w.voidReason}</p>}
          </div>

          {/* ผู้รับ */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-brand-50/60 p-4 text-sm sm:grid-cols-4 print:bg-transparent print:ring-1 print:ring-brand-100">
            {[
              ["เรียน", fullName(e)],
              ["รหัสพนักงาน", e.code],
              ["ตำแหน่ง", row.pos ?? "-"],
              ["สาขา", row.branch ?? "-"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-stone-500">{k}</dt>
                <dd className="font-medium break-words text-brand-900">{v}</dd>
              </div>
            ))}
          </dl>

          {/* เนื้อหา */}
          <section className="space-y-4 text-[15px] leading-relaxed text-brand-900 sm:text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-brand-100 p-3">
                <p className="text-xs text-stone-500">ประเภทความผิด</p>
                <p className="font-medium">{w.category}</p>
              </div>
              <div className="rounded-2xl border border-brand-100 p-3">
                <p className="text-xs text-stone-500">วันที่เกิดเหตุ</p>
                <p className="font-medium">{fmtDate(w.incidentDate)}</p>
              </div>
              <div className="rounded-2xl border border-brand-100 p-3">
                <p className="text-xs text-stone-500">มีผลถึง</p>
                <p className="font-medium">{fmtDate(validUntil(w.incidentDate))}</p>
              </div>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">รายละเอียดการกระทำผิด</h3>
              <p className="whitespace-pre-line text-stone-700">{w.reason}</p>
            </div>
            {w.action && (
              <div>
                <h3 className="mb-1 font-semibold">สิ่งที่ต้องปรับปรุง</h3>
                <p className="whitespace-pre-line text-stone-700">{w.action}</p>
              </div>
            )}
            <p className="rounded-2xl bg-stone-50 p-3 text-xs text-stone-600 print:bg-transparent print:p-0">
              บริษัทฯ ขอตักเตือนให้ท่านปฏิบัติตามระเบียบข้อบังคับของบริษัทฯ อย่างเคร่งครัด
              {w.level === "final" ? " หากกระทำผิดซ้ำในเรื่องเดียวกันภายในกำหนด บริษัทฯ อาจพิจารณาเลิกจ้างโดยไม่จ่ายค่าชดเชยตามกฎหมาย" : " หากกระทำผิดซ้ำ บริษัทฯ จะพิจารณาดำเนินการทางวินัยในขั้นต่อไป"}
            </p>
          </section>

          {/* ลงชื่อ */}
          <section className="grid gap-6 border-t border-brand-100 pt-5 text-sm sm:grid-cols-2 print:break-inside-avoid">
            <div>
              <p className="text-xs text-stone-500">ผู้ออกใบเตือน</p>
              <p className="font-medium text-brand-900">{row.issuer ? fullName(row.issuer) : (row.issuerUser ?? "ฝ่ายบุคคล")}</p>
              <p className="text-xs text-stone-500">ฝ่ายบุคคล · {fmtDateTime(w.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">พนักงานรับทราบ</p>
              {w.acknowledgedAt ? (
                <>
                  <p className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <Icon name="checkCircle" className="size-4" />
                    รับทราบแล้วผ่านระบบ
                  </p>
                  <p className="text-xs text-stone-500">{fmtDateTime(w.acknowledgedAt)}</p>
                </>
              ) : (
                <p className="font-medium text-amber-700">ยังไม่รับทราบ</p>
              )}
            </div>
            {w.employeeNote && (
              <div className="sm:col-span-2">
                <p className="text-xs text-stone-500">คำชี้แจงของพนักงาน</p>
                <p className="mt-0.5 rounded-2xl bg-brand-50/60 p-3 whitespace-pre-line text-brand-900">{w.employeeNote}</p>
              </div>
            )}
          </section>
        </div>
      </article>

      {/* พนักงาน: กดรับทราบ */}
      {mine && !w.acknowledgedAt && status !== "voided" && (
        <Card title="รับทราบใบเตือน" subtitle="การกดรับทราบไม่ได้แปลว่ายอมรับว่ากระทำผิด — คุณสามารถเขียนชี้แจงได้" className="no-print mt-5">
          <form action={acknowledgeWarning} className="space-y-3">
            <input type="hidden" name="id" value={w.id} />
            <Field label="คำชี้แจง (ไม่บังคับ)">
              <Textarea name="employeeNote" rows={3} maxLength={1000} placeholder="ชี้แจงเหตุผลหรือข้อเท็จจริงเพิ่มเติมถึงฝ่ายบุคคล" />
            </Field>
            <SubmitButton>รับทราบ</SubmitButton>
          </form>
        </Card>
      )}

      {/* HR: ข้อมูลประกอบ + ยกเลิก */}
      {hr && (
        <div className="no-print mt-5 grid gap-5 sm:grid-cols-2">
          <Card title="ประวัติของพนักงานคนนี้">
            <p className="text-sm text-stone-600">มีใบเตือนอื่นอีก {count} ใบ</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/warnings?employee=${e.id}`} className="rounded-full border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-50">
                ดูประวัติทั้งหมด
              </Link>
              <Link href={`/warnings/new?employee=${e.id}`} className="rounded-full border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-50">
                ออกใบเตือนใหม่
              </Link>
            </div>
          </Card>
          {status !== "voided" && (
            <Card title="ยกเลิกใบเตือน" subtitle="เช่น ออกผิดคน หรือสอบข้อเท็จจริงแล้วไม่มีความผิด — ประวัติยังคงเก็บไว้">
              <form action={voidWarning} className="space-y-3">
                <input type="hidden" name="id" value={w.id} />
                <Textarea name="voidReason" rows={2} required minLength={5} placeholder="เหตุผลที่ยกเลิก" />
                <SubmitButton variant="secondary" confirm="ยืนยันยกเลิกใบเตือนนี้?">
                  ยกเลิกใบเตือน
                </SubmitButton>
              </form>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
