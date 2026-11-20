import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employees, users } from "@/db/schema";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Flash, Input } from "@/components/ui";
import { canDecide, HEAD_IS_FINAL, leaveOverlaps, pendingWithStage } from "@/lib/approval";
import { isHR, requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { fullName } from "@/lib/util";
import { decideRequest } from "../actions";
import { RequestSummary, TypeBadge } from "../request-detail";

export const metadata = { title: "รออนุมัติ" };

export default async function Inbox({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  if (u.role === "employee") redirect("/requests/mine");
  const sp = await searchParams;
  const all = await pendingWithStage();
  const mine = all.filter((x) => canDecide(u, x.r, x.headId, x.actingId));
  // HR เห็นคำขอที่ยังค้างอยู่ที่หัวหน้าแผนก (ดูอย่างเดียว — ข้ามขั้นไม่ได้)
  const waitingHead = isHR(u) ? all.filter((x) => x.stage === "head" && !canDecide(u, x.r, x.headId, x.actingId)) : [];

  // ชื่อหัวหน้า / ผู้อนุมัติขั้นแรก
  const headIds = [...new Set(all.map((x) => x.headId).filter((v): v is number => !!v))];
  const approverIds = [...new Set(all.map((x) => x.r.headApprovedBy).filter((v): v is number => !!v))];
  const [heads, approvers] = await Promise.all([
    headIds.length ? db.select().from(employees).where(inArray(employees.id, headIds)) : Promise.resolve([]),
    approverIds.length
      ? db
          .select({ id: users.id, username: users.username, first: employees.firstName, last: employees.lastName })
          .from(users)
          .leftJoin(employees, eq(users.employeeId, employees.id))
          .where(inArray(users.id, approverIds))
      : Promise.resolve([]),
  ]);
  const headName = new Map(heads.map((h) => [h.id, fullName(h)]));
  // คนในแผนกเดียวกันที่ลาวันทับกัน (เตือนก่อนอนุมัติ)
  const overlaps = await leaveOverlaps(
    mine
      .filter((x) => x.r.type === "leave")
      .map((x) => ({ id: x.r.id, employeeId: x.e.id, departmentId: x.e.departmentId, startDate: x.r.startDate, endDate: x.r.endDate })),
  );
  const approverName = new Map(approvers.map((a) => [a.id, a.first ? `${a.first} ${a.last}` : a.username]));

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      {mine.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-brand-200 bg-white p-10 text-center text-stone-500">
          <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon name="tick" className="size-5" strokeWidth={2.4} />
          </span>
          ไม่มีคำขอรออนุมัติจากคุณ
        </div>
      ) : (
        <div className="space-y-3">
          {mine.map(({ r, e, leaveName, stage, headId, actingId }) => {
            const finalAtHead = stage === "head" && HEAD_IS_FINAL.has(r.type);
            return (
              <div key={r.id} className="rounded-3xl border border-brand-200/80 bg-white p-4 shadow-card sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={r.type} />
                      <span className="font-semibold text-brand-900">{fullName(e)}</span>
                      <span className="text-xs text-stone-400">{e.code}</span>
                    </div>
                    <div className="mt-1.5 text-[15px] sm:text-sm">
                      <RequestSummary r={r} leaveName={leaveName} />
                    </div>
                    {r.reason && <div className="mt-1 text-sm text-stone-500">เหตุผล: {r.reason}</div>}
                    {overlaps.get(r.id) && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
                        <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                        <span>
                          ช่วงเดียวกันในแผนกมีคนลา {overlaps.get(r.id)!.length} คน:{" "}
                          {overlaps
                            .get(r.id)!
                            .map(
                              (o) =>
                                `${o.name} (${fmtDate(o.startDate)}${o.endDate !== o.startDate ? `–${fmtDate(o.endDate)}` : ""}${o.status === "pending" ? " · รออนุมัติ" : ""})`,
                            )
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    <div className="mt-1 text-xs text-stone-400">ยื่นเมื่อ {fmtDateTime(r.createdAt)}</div>
                  </div>
                  <Badge tone={stage === "head" ? "amber" : "blue"}>
                    {stage === "head" ? (finalAtHead ? "หัวหน้าแผนกอนุมัติ (ขั้นเดียว)" : "ขั้นที่ 1: หัวหน้าแผนก") : "ขั้นสุดท้าย: HR"}
                  </Badge>
                </div>

                {/* ลำดับขั้น */}
                <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-brand-50/60 px-3 py-2 text-xs text-stone-600">
                  <li className="flex items-center gap-1">
                    <Icon
                      name={r.headApprovedAt ? "checkCircle" : stage === "head" ? "clock" : "info"}
                      className={r.headApprovedAt ? "size-4 text-emerald-600" : "size-4 text-amber-600"}
                    />
                    {r.headApprovedAt
                      ? `หัวหน้าอนุมัติแล้ว: ${approverName.get(r.headApprovedBy!) ?? "-"} · ${fmtDateTime(r.headApprovedAt)}${r.headNote ? ` · “${r.headNote}”` : ""}`
                      : stage === "head"
                        ? u.employeeId !== headId && u.employeeId === actingId
                          ? `รอคุณอนุมัติแทน ${headName.get(headId!) ?? "หัวหน้า"} (หัวหน้าลาอยู่)`
                          : "รอคุณอนุมัติในฐานะหัวหน้าแผนก"
                        : "ไม่มีหัวหน้าแผนก — ส่งตรงถึง HR"}
                  </li>
                  {!finalAtHead && (
                    <>
                      <Icon name="chevronRight" className="size-3.5 text-stone-400" />
                      <li className={stage === "hr" ? "font-medium text-brand-900" : ""}>HR อนุมัติขั้นสุดท้าย</li>
                    </>
                  )}
                  {finalAtHead && (
                    <>
                      <Icon name="chevronRight" className="size-3.5 text-stone-400" />
                      <li>แจ้ง HR ให้ทราบ</li>
                    </>
                  )}
                </ol>

                <form action={decideRequest} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <Input name="note" placeholder="หมายเหตุ (ถ้ามี)" className="max-w-xs min-w-48 flex-1" />
                  <SubmitButton name="decision" value="approved" variant="success">
                    {stage === "head" && !finalAtHead ? "อนุมัติ ส่งต่อ HR" : "อนุมัติ"}
                  </SubmitButton>
                  <SubmitButton name="decision" value="rejected" variant="secondary" confirm="ยืนยันไม่อนุมัติ?">
                    ไม่อนุมัติ
                  </SubmitButton>
                </form>
              </div>
            );
          })}
        </div>
      )}

      {waitingHead.length > 0 && (
        <Card title={`รอหัวหน้าแผนกอนุมัติ ${waitingHead.length} รายการ`} subtitle="HR ดูได้อย่างเดียว — เมื่อหัวหน้าอนุมัติแล้ว คำขอจะย้ายมาให้ HR อนุมัติขั้นสุดท้าย" className="mt-6">
          <ul className="divide-y divide-brand-100">
            {waitingHead.map(({ r, e, leaveName, headId }) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <TypeBadge type={r.type} />
                <span className="font-medium text-brand-900">{fullName(e)}</span>
                <span className="text-stone-600">
                  <RequestSummary r={r} leaveName={leaveName} />
                </span>
                <span className="ml-auto text-xs text-amber-700">รอ {headId ? headName.get(headId) : "หัวหน้า"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
