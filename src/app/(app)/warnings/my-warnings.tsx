import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { warnings } from "@/db/schema";
import { Icon } from "@/components/icons";
import { Badge, Card, Flash, PageHeader, Stat } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";
import { bkkDateStr, fmtDate } from "@/lib/time";
import { cn } from "@/lib/util";
import { effectiveUntil, WARNING_STATUS, WARNING_TONE, warningStatus } from "@/lib/warning";
import { getWarningConfig } from "@/lib/warning-config";

/** หน้าใบเตือนของพนักงานเอง (ไม่แสดงใบที่ HR ยกเลิกแล้ว) */
export async function MyWarnings({ user, ok, error }: { user: CurrentUser; ok?: string; error?: string }) {
  const today = bkkDateStr();
  const wcfg = await getWarningConfig();
  const rows = user.employeeId
    ? (await db.select().from(warnings).where(eq(warnings.employeeId, user.employeeId)).orderBy(desc(warnings.incidentDate), desc(warnings.id))).filter((w) => !w.voidedAt)
    : [];
  const withStatus = rows.map((w) => ({ w, st: warningStatus(w, today) }));
  const pending = withStatus.filter((x) => x.st === "pending");
  const active = withStatus.filter((x) => x.st === "pending" || x.st === "acknowledged");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="ใบเตือนของฉัน" subtitle="ประวัติการตักเตือนและหนังสือเตือนที่คุณได้รับ" />
      <Flash ok={ok} error={error} />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-brand-200/80 bg-white p-10 text-center shadow-card">
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon name="shield" className="size-7" />
          </span>
          <p className="text-lg font-semibold text-brand-900">คุณไม่มีใบเตือน</p>
          <p className="max-w-sm text-sm text-stone-500">ขอบคุณที่ปฏิบัติตามระเบียบของบริษัทอย่างสม่ำเสมอ</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-5 flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Icon name="alert" className="size-5" />
              </span>
              <p className="flex-1 text-[15px] text-amber-900 sm:text-sm">
                มีใบเตือน <b>{pending.length} ใบ</b> ที่ยังไม่ได้กดรับทราบ — กรุณาเปิดอ่านและกดรับทราบ (เขียนชี้แจงได้)
              </p>
              <Link href={`/warnings/${pending[0].w.id}`} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
                เปิดอ่าน
                <Icon name="chevronRight" className="size-4" />
              </Link>
            </div>
          )}

          <div className="mb-5 grid grid-cols-3 gap-3">
            <Stat label="ยังมีผลอยู่" value={active.length} tone={active.length ? "warn" : "good"} />
            <Stat label="รอรับทราบ" value={pending.length} tone={pending.length ? "bad" : "default"} />
            <Stat label="ทั้งหมด" value={rows.length} />
          </div>

          {/* เส้นเวลา */}
          <ol className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:left-[19px] before:w-px before:bg-brand-200">
            {withStatus.map(({ w, st }) => {
              const lv = wcfg.level[w.level];
              const expired = st === "expired";
              return (
                <li key={w.id} className="relative pl-12">
                  <span
                    className={cn(
                      "absolute top-4 left-0 flex size-10 items-center justify-center rounded-full ring-4 ring-canvas",
                      expired ? "bg-stone-100 text-stone-400" : w.level === "final" ? "bg-rose-100 text-rose-600" : w.level === "written" ? "bg-amber-100 text-amber-700" : "bg-brand-100 text-brand-700",
                    )}
                  >
                    <Icon name="flag" className="size-5" />
                  </span>
                  <Link
                    href={`/warnings/${w.id}`}
                    className={cn("block rounded-3xl border bg-white p-4 shadow-card transition hover:shadow-lift sm:p-5", st === "pending" ? "border-amber-300" : "border-brand-200/80", expired && "opacity-70")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={expired ? "gray" : WARNING_TONE[w.level]}>{lv.name}</Badge>
                      <Badge tone={WARNING_STATUS[st].tone}>{st === "pending" ? "กรุณากดรับทราบ" : WARNING_STATUS[st].label}</Badge>
                      <span className="ml-auto text-xs text-stone-400">W-{String(w.id).padStart(5, "0")}</span>
                    </div>
                    <p className="mt-2 font-semibold text-brand-900">{w.category}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-stone-600">{w.reason}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                      <span>เกิดเหตุ {fmtDate(w.incidentDate)}</span>
                      <span>{expired ? "พ้นกำหนดเมื่อ" : "มีผลถึง"} {fmtDate(effectiveUntil(w))}</span>
                      <span className="ml-auto inline-flex items-center gap-0.5 font-medium text-brand-700">
                        ดูรายละเอียด
                        <Icon name="chevronRight" className="size-4" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <Card title="เกี่ยวกับใบเตือน" className="mt-6">
        <ul className="space-y-2 text-sm text-stone-600">
          <li className="flex gap-2">
            <Icon name="info" className="mt-0.5 size-4 text-brand-500" />
            ใบเตือนแต่ละใบมีผลถึงวันที่ระบุไว้ (นับจากวันที่เกิดเหตุ ไม่เกิน 1 ปีตามกฎหมาย) หลังจากนั้นจะแสดงเป็น "พ้นกำหนดแล้ว" แต่ยังเก็บไว้เป็นประวัติ
          </li>
          <li className="flex gap-2">
            <Icon name="info" className="mt-0.5 size-4 text-brand-500" />
            การกดรับทราบเป็นการยืนยันว่าได้อ่านแล้ว ไม่ได้แปลว่ายอมรับว่ากระทำผิด — คุณเขียนชี้แจงถึงฝ่ายบุคคลได้
          </li>
          <li className="flex gap-2">
            <Icon name="info" className="mt-0.5 size-4 text-brand-500" />
            หากมีข้อสงสัย กรุณาติดต่อฝ่ายบุคคล
          </li>
        </ul>
      </Card>
    </div>
  );
}
