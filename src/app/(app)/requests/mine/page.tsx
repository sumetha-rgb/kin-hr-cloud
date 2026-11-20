import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { leaveTypes, requests } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { Card, DesktopOnly, Flash, LinkButton, MobileCard, MobileList, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { bkkDateStr, fmtDateTime } from "@/lib/time";
import { cancelRequest } from "../actions";
import { headOf, namesOf, stageOf } from "@/lib/approval";
import { ApprovalTrail, RequestSummary, StatusBadge, TypeBadge } from "../request-detail";

export const metadata = { title: "คำขอของฉัน" };

export default async function MyRequests({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  if (!u.employeeId) return <p className="text-stone-500">บัญชีนี้ไม่ได้ผูกกับพนักงาน</p>;
  const year = bkkDateStr().slice(0, 4);

  const [rows, balance] = await Promise.all([
    db
      .select({ r: requests, leaveName: leaveTypes.name })
      .from(requests)
      .leftJoin(leaveTypes, eq(requests.leaveTypeId, leaveTypes.id))
      .where(eq(requests.employeeId, u.employeeId))
      .orderBy(desc(requests.createdAt))
      .limit(100),
    db
      .select({
        id: leaveTypes.id,
        name: leaveTypes.name,
        quota: leaveTypes.daysPerYear,
        used: sql<string>`coalesce(sum(${requests.days}) filter (where ${requests.status} = 'approved'), 0)`,
        pending: sql<string>`coalesce(sum(${requests.days}) filter (where ${requests.status} = 'pending'), 0)`,
      })
      .from(leaveTypes)
      .leftJoin(
        requests,
        and(
          eq(requests.leaveTypeId, leaveTypes.id),
          eq(requests.employeeId, u.employeeId),
          inArray(requests.status, ["approved", "pending"]),
          gte(requests.startDate, `${year}-01-01`),
          lte(requests.startDate, `${year}-12-31`),
        ),
      )
      .groupBy(leaveTypes.id)
      .orderBy(leaveTypes.id),
  ]);

  // ตอนนี้รอใคร: หัวหน้าของฉัน (รายคน/หัวหน้าแผนก) + ชื่อคนที่อนุมัติไปแล้ว
  const headId = await headOf(u.employeeId);
  const names = await namesOf({
    employees: [headId],
    users: rows.flatMap(({ r }) => [r.headApprovedBy, r.decidedBy]),
  });
  const headName = headId ? (names.employee.get(headId) ?? null) : null;

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <Card title={`สิทธิ์การลาปี ${Number(year) + 543}`} className="mb-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {balance.map((b) => (
            <div key={b.id} className="rounded-lg bg-stone-50 p-3">
              <div className="text-sm text-stone-500">{b.name}</div>
              <div className="text-lg font-semibold">
                {b.quota ? `${b.quota - Number(b.used)} / ${b.quota}` : `ใช้ ${Number(b.used)}`} <span className="text-sm font-normal">วัน</span>
              </div>
              {Number(b.pending) > 0 && <div className="text-xs text-amber-600">รออนุมัติ {Number(b.pending)} วัน</div>}
            </div>
          ))}
        </div>
      </Card>
      <div className="mb-3 flex flex-wrap gap-2">
        <LinkButton href="/requests/new?type=leave">ยื่นใบลา</LinkButton>
        <LinkButton href="/requests/new?type=ot" variant="secondary">
          ขอทำ OT
        </LinkButton>
        <LinkButton href="/requests/new?type=time_correction" variant="secondary">
          ขอแก้ไขเวลา
        </LinkButton>
      </div>
      <MobileList empty={!rows.length}>
        {rows.map(({ r, leaveName }) => (
          <MobileCard key={r.id}>
            <div className="flex items-center justify-between gap-2">
              <TypeBadge type={r.type} />
              <StatusBadge r={r} stage={stageOf(r, headId)} />
            </div>
            <div className="mt-2 text-[15px] text-brand-900">
              <RequestSummary r={r} leaveName={leaveName} />
            </div>
            <ApprovalTrail r={r} headName={headName} userName={names.user} />
            {r.reason && <div className="mt-1 text-sm text-stone-500">“{r.reason}”</div>}
            {r.decisionNote && <div className="mt-1 text-sm text-stone-500">หมายเหตุผู้อนุมัติ: {r.decisionNote}</div>}
            <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
              <span>ยื่นเมื่อ {fmtDateTime(r.createdAt)}</span>
              {r.status === "pending" && (
                <form action={cancelRequest}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton variant="ghost" confirm="ยกเลิกคำขอนี้?">
                    ยกเลิก
                  </SubmitButton>
                </form>
              )}
            </div>
          </MobileCard>
        ))}
      </MobileList>
      <DesktopOnly>
        <Table head={["ยื่นเมื่อ", "ประเภท", "รายละเอียด", "เหตุผล", "สถานะ", ""]} empty={!rows.length}>
          {rows.map(({ r, leaveName }) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-stone-500">{fmtDateTime(r.createdAt)}</td>
              <td>
                <TypeBadge type={r.type} />
              </td>
              <td>
                <RequestSummary r={r} leaveName={leaveName} />
              </td>
              <td className="max-w-56 truncate text-stone-500">{r.reason}</td>
              <td>
                <StatusBadge r={r} stage={stageOf(r, headId)} />
                <ApprovalTrail r={r} headName={headName} userName={names.user} />
                {r.decisionNote && <div className="text-xs text-stone-400">{r.decisionNote}</div>}
              </td>
              <td>
                {r.status === "pending" && (
                  <form action={cancelRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton variant="ghost" confirm="ยกเลิกคำขอนี้?">
                      ยกเลิก
                    </SubmitButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </DesktopOnly>
    </>
  );
}
