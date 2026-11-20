import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employees, leaveTypes, requests } from "@/db/schema";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Flash, Input } from "@/components/ui";
import { approvableWhere } from "@/lib/approval";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { fullName } from "@/lib/util";
import { decideRequest } from "../actions";
import { RequestSummary, StatusBadge, TypeBadge } from "../request-detail";

export const metadata = { title: "รออนุมัติ" };

export default async function Inbox({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  if (u.role === "employee") redirect("/requests/mine");
  const sp = await searchParams;
  const rows = await db
    .select({ r: requests, e: employees, leaveName: leaveTypes.name })
    .from(requests)
    .innerJoin(employees, eq(requests.employeeId, employees.id))
    .leftJoin(leaveTypes, eq(requests.leaveTypeId, leaveTypes.id))
    .where(and(eq(requests.status, "pending"), approvableWhere(u)))
    .orderBy(asc(requests.createdAt));

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-brand-200 bg-white p-10 text-center text-stone-500">
          <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon name="tick" className="size-5" strokeWidth={2.4} />
          </span>
          ไม่มีคำขอรออนุมัติ
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ r, e, leaveName }) => (
            <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <TypeBadge type={r.type} />
                    <span className="font-medium">{fullName(e)}</span>
                    <span className="text-xs text-stone-400">{e.code}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    <RequestSummary r={r} leaveName={leaveName} />
                  </div>
                  {r.reason && <div className="mt-1 text-sm text-stone-500">“{r.reason}”</div>}
                  <div className="mt-1 text-xs text-stone-400">ยื่นเมื่อ {fmtDateTime(r.createdAt)}</div>
                </div>
                <StatusBadge r={r} />
              </div>
              <form action={decideRequest} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={r.id} />
                <Input name="note" placeholder="หมายเหตุ (ถ้ามี)" className="max-w-xs flex-1" />
                <SubmitButton name="decision" value="approved" variant="success">
                  อนุมัติ
                </SubmitButton>
                <SubmitButton name="decision" value="rejected" variant="secondary" confirm="ยืนยันไม่อนุมัติ?">
                  ไม่อนุมัติ
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
