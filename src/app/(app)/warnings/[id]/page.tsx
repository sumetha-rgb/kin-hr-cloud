/* eslint-disable @next/next/no-img-element */
import { and, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Sarabun } from "next/font/google";
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
import { fmtDateLong, fmtDateTime } from "@/lib/time";
import { cn, fullName } from "@/lib/util";
import { effectiveUntil, WARNING_STATUS, warningStatus } from "@/lib/warning";
import { getWarningConfig } from "@/lib/warning-config";
import { acknowledgeWarning, voidWarning } from "../actions";

export const metadata = { title: "หนังสือเตือน" };

// ฟอนต์เอกสารทางการ (สารบรรณ) ใช้เฉพาะตัวหนังสือเตือน
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "600", "700"], display: "swap" });


/** ช่องลงลายมือชื่อแบบเส้นประ */
function Signature({ role, name, sub }: { role: string; name?: string; sub?: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="whitespace-nowrap">
        ลงชื่อ <span className="inline-block w-44 border-b border-dotted border-stone-500 align-bottom" /> {role}
      </p>
      <p className="mt-1.5">( {name ?? <span className="inline-block w-40 border-b border-dotted border-stone-500 align-bottom" />} )</p>
      {sub && <div className="mt-1 text-[13px] text-stone-600">{sub}</div>}
    </div>
  );
}

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
  // พนักงานเห็นเฉพาะของตัวเอง และไม่เห็นใบที่ถูกยกเลิก
  if (!row || (!hr && (row.w.employeeId !== u.employeeId || row.w.voidedAt))) notFound();
  const { w, e } = row;
  const [company, others] = await Promise.all([getSettings(), db.$count(warnings, and(eq(warnings.employeeId, e.id), ne(warnings.id, w.id)))]);
  const status = warningStatus(w);
  const mine = w.employeeId === u.employeeId;
  const issuerName = row.issuer ? fullName(row.issuer) : undefined;
  const until = fmtDateLong(effectiveUntil(w));
  const lv = (await getWarningConfig()).level[w.level];
  const TITLE = { [w.level]: lv.docTitle } as Record<string, string>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={hr ? `/warnings?employee=${e.id}` : "/warnings"} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
          <Icon name="chevronLeft" className="size-4" />
          {hr ? "ใบเตือนทั้งหมดของพนักงานคนนี้" : "ใบเตือนของฉัน"}
        </Link>
        <PrintButton />
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,210mm)_1fr]">
        {/* ===================== ตัวเอกสาร (ส่วนที่พิมพ์) ===================== */}
        <article
          className={cn(
            sarabun.className,
            "relative overflow-hidden bg-white px-6 py-8 text-[15px] leading-[1.9] text-stone-900 shadow-lift ring-1 ring-stone-200 sm:px-[18mm] sm:py-[16mm] print:p-0 print:text-[14.5px] print:leading-[1.7] print:shadow-none print:ring-0",
          )}
        >
          {status === "voided" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
              <span className="-rotate-[28deg] rounded-xl border-[6px] border-rose-500/40 px-10 py-2 text-7xl font-bold tracking-widest text-rose-500/40">ยกเลิก</span>
            </div>
          )}

          {/* หัวกระดาษ */}
          <header className="flex items-center gap-4 border-b-2 border-stone-800 pb-4">
            <img src="/kin-logo.png" alt="" width={64} height={64} className="shrink-0" />
            <div className="min-w-0 leading-snug">
              <p className="text-[17px] font-bold">{company.name}</p>
              {company.address && <p className="text-[13px] text-stone-700">{company.address}</p>}
              {company.taxId && <p className="text-[13px] text-stone-700">เลขประจำตัวผู้เสียภาษี {company.taxId}</p>}
            </div>
          </header>

          <h1 className="mt-6 text-center text-[22px] font-bold tracking-wide print:mt-4">{TITLE[w.level]}</h1>

          <div className="mt-4 flex flex-col justify-between gap-1 sm:flex-row">
            <p>เลขที่ W-{String(w.id).padStart(5, "0")}</p>
            <p>วันที่ {fmtDateLong(w.issuedAt)}</p>
          </div>

          <table className="mt-4 w-full border-collapse align-top [&_td]:align-top [&_td]:py-0.5">
            <tbody>
              <tr>
                <td className="w-16 font-semibold">เรื่อง</td>
                <td>ตักเตือนกรณี{w.category}</td>
              </tr>
              <tr>
                <td className="font-semibold">เรียน</td>
                <td>
                  {fullName(e)}
                  <span className="block text-stone-700">
                    รหัสพนักงาน {e.code}
                    {row.pos ? `  ตำแหน่ง ${row.pos}` : ""}
                    {row.branch ? `  สังกัด ${row.branch}` : ""}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* เนื้อความ */}
          <div className="mt-5 space-y-3 text-justify [&>p]:indent-[2.5em]">
            <p>ด้วยปรากฏว่า เมื่อวันที่ {fmtDateLong(w.incidentDate)} ท่านได้กระทำความผิดกรณี{w.category} โดยมีรายละเอียดดังนี้</p>
            <p className="whitespace-pre-line">{w.reason}</p>
            <p>
              การกระทำดังกล่าวเป็นการฝ่าฝืนข้อบังคับเกี่ยวกับการทำงานของบริษัทฯ บริษัทฯ จึงขอ
              {w.level === "verbal" ? "ตักเตือนด้วยวาจาและบันทึกไว้เป็นหลักฐาน" : "ตักเตือนท่านเป็นลายลักษณ์อักษร"} เพื่อให้ท่านปรับปรุงแก้ไขและไม่กระทำผิดซ้ำอีก
            </p>
            {w.action && <p className="whitespace-pre-line">ทั้งนี้ ให้ท่านปฏิบัติดังนี้ {w.action}</p>}
            {/* ข้อความท้ายหนังสือ: HR ตั้งได้ที่ ตั้งค่าองค์กร → ใบเตือน */}
            {w.level === "verbal" ? (
              lv.closingText && <p>{lv.closingText}</p>
            ) : (
              <p>
                {lv.docTitle}ฉบับนี้มีผลบังคับนับแต่วันที่ท่านได้กระทำความผิด จนถึงวันที่ {until}
                {lv.closingText ? ` ${lv.closingText}` : ""}
              </p>
            )}
            <p>จึงเรียนมาเพื่อทราบและถือปฏิบัติโดยเคร่งครัด</p>
          </div>

          {/* ผู้ออกหนังสือ */}
          <div className="mt-10 flex justify-end print:mt-6 print:break-inside-avoid">
            <div className="text-center">
              <p className="mb-8 print:mb-6">ขอแสดงความนับถือ</p>
              <Signature role="ผู้ออกหนังสือ" name={issuerName} sub="ฝ่ายบุคคล" />
            </div>
          </div>

          {/* การรับทราบ */}
          <section className="mt-10 border-t border-stone-300 pt-5 print:mt-6 print:pt-3 print:break-inside-avoid">
            <p className="font-semibold">การรับทราบของพนักงาน</p>
            <p className="indent-[2.5em]">ข้าพเจ้าได้รับและอ่านทำความเข้าใจ{TITLE[w.level]}ฉบับนี้แล้ว</p>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 print:mt-6 print:grid-cols-2">

              <Signature
                role="ผู้รับทราบ"
                name={fullName(e)}
                sub={w.acknowledgedAt ? `รับทราบผ่านระบบ KIN HR เมื่อ ${fmtDateTime(w.acknowledgedAt)} น.` : "วันที่ ........ / ........ / ........"}
              />
              <Signature role="พยาน" sub="วันที่ ........ / ........ / ........" />
            </div>
          </section>

          {status === "voided" && (
            <p className="mt-8 border-t border-rose-300 pt-3 text-[13px] text-rose-700">
              ยกเลิกเมื่อ {fmtDateTime(w.voidedAt)} น. เหตุผล: {w.voidReason}
            </p>
          )}
        </article>

        {/* ===================== แผงข้าง (ไม่พิมพ์) ===================== */}
        <aside className="no-print space-y-5">
          <Card title="สถานะ">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">สถานะ</dt>
                <dd>
                  <Badge tone={WARNING_STATUS[status].tone}>{WARNING_STATUS[status].label}</Badge>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-stone-500">มีผลถึง</dt>
                <dd className="font-medium text-brand-900">{until}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-stone-500">ออกโดย</dt>
                <dd className="text-right font-medium text-brand-900">
                  {issuerName ?? row.issuerUser ?? "ฝ่ายบุคคล"}
                  <span className="block text-xs font-normal text-stone-500">{fmtDateTime(w.issuedAt)}</span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-stone-500">พนักงานรับทราบ</dt>
                <dd className={cn("text-right font-medium", w.acknowledgedAt ? "text-emerald-700" : "text-amber-700")}>
                  {w.acknowledgedAt ? fmtDateTime(w.acknowledgedAt) : "ยังไม่รับทราบ"}
                </dd>
              </div>
            </dl>
            {w.employeeNote && (
              <div className="mt-4 rounded-2xl bg-brand-50/70 p-3 text-sm">
                <p className="text-xs text-stone-500">คำชี้แจงของพนักงาน</p>
                <p className="mt-0.5 whitespace-pre-line text-brand-900">{w.employeeNote}</p>
              </div>
            )}
            {status === "voided" && <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm text-stone-600">ยกเลิกแล้ว: {w.voidReason}</p>}
          </Card>

          {/* พนักงาน: กดรับทราบ */}
          {mine && !w.acknowledgedAt && status !== "voided" && (
            <Card title="รับทราบใบเตือน" subtitle="การกดรับทราบไม่ได้แปลว่ายอมรับว่ากระทำผิด — เขียนชี้แจงถึงฝ่ายบุคคลได้">
              <form action={acknowledgeWarning} className="space-y-3">
                <input type="hidden" name="id" value={w.id} />
                <Field label="คำชี้แจง (ไม่บังคับ)">
                  <Textarea name="employeeNote" rows={3} maxLength={1000} placeholder="ชี้แจงเหตุผลหรือข้อเท็จจริงเพิ่มเติม" />
                </Field>
                <SubmitButton>รับทราบ</SubmitButton>
              </form>
            </Card>
          )}

          {/* HR */}
          {hr && (
            <>
              <Card title="ประวัติของพนักงานคนนี้">
                <p className="text-sm text-stone-600">มีใบเตือนอื่นอีก {others} ใบ</p>
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
                <Card title="ยกเลิกใบเตือน" subtitle="เช่น ออกผิดคน หรือสอบข้อเท็จจริงแล้วไม่มีความผิด — ประวัติยังเก็บไว้">
                  <form action={voidWarning} className="space-y-3">
                    <input type="hidden" name="id" value={w.id} />
                    <Textarea name="voidReason" rows={2} required minLength={5} placeholder="เหตุผลที่ยกเลิก" />
                    <SubmitButton variant="secondary" confirm="ยืนยันยกเลิกใบเตือนนี้?">
                      ยกเลิกใบเตือน
                    </SubmitButton>
                  </form>
                </Card>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
