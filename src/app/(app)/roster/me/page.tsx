import { and, asc, desc, eq, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { employees, holidays, shiftSwaps, shifts } from "@/db/schema";
import { EmployeePicker } from "@/components/employee-picker";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Flash, Input, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { effectiveShiftId, loadRoster, shiftShort, shiftTone } from "@/lib/roster";
import { addDays, bkkDateStr, eachDate, fmtDate, isoWeekday, WEEKDAY_TH } from "@/lib/time";
import { cn, fullName } from "@/lib/util";
import { cancelSwap, requestSwap, respondSwap } from "../actions";

export const metadata = { title: "ตารางเวรของฉัน" };

const STATUS = {
  pending_partner: { label: "รอเพื่อนตอบรับ", tone: "amber" },
  pending_head: { label: "รอหัวหน้าอนุมัติ", tone: "blue" },
  approved: { label: "อนุมัติแล้ว", tone: "green" },
  rejected: { label: "ไม่อนุมัติ", tone: "red" },
  cancelled: { label: "ยกเลิก", tone: "gray" },
} as const;

export default async function MyRoster({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  if (!u.employeeId) return <p className="text-stone-500">บัญชีนี้ไม่ได้ผูกกับพนักงาน</p>;
  const today = bkkDateStr();
  const end = addDays(today, 27);
  const [[me], allShifts, hol] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, u.employeeId)),
    db.select().from(shifts),
    db.select().from(holidays),
  ]);
  const [roster, peers] = await Promise.all([
    loadRoster(today, end, [me.id]),
    me.departmentId
      ? db
          .select()
          .from(employees)
          .where(and(eq(employees.departmentId, me.departmentId), ne(employees.id, me.id), ne(employees.status, "resigned")))
          .orderBy(asc(employees.code))
      : Promise.resolve([]),
  ]);
  const byId = new Map(allShifts.map((s) => [s.id, s]));
  const holiday = new Map(hol.map((h) => [h.date, h.name]));
  const days = eachDate(today, end).map((d) => {
    const sid = effectiveShiftId(me, d, roster, byId);
    return { d, shift: sid ? byId.get(sid) : null, changed: roster.get(me.id)?.has(d) };
  });

  const req = alias(employees, "req");
  const par = alias(employees, "par");
  const swaps = await db
    .select({ s: shiftSwaps, req, par })
    .from(shiftSwaps)
    .innerJoin(req, eq(shiftSwaps.requesterId, req.id))
    .innerJoin(par, eq(shiftSwaps.partnerId, par.id))
    .where(or(eq(shiftSwaps.requesterId, me.id), eq(shiftSwaps.partnerId, me.id)))
    .orderBy(desc(shiftSwaps.createdAt))
    .limit(30);
  const incoming = swaps.filter((x) => x.s.partnerId === me.id && x.s.status === "pending_partner");

  return (
    <>
      <PageHeader title="ตารางเวรของฉัน" subtitle="เวร 4 สัปดาห์ข้างหน้า · ขอแลกเวรกับเพื่อนในแผนก (เพื่อนตอบรับ แล้วหัวหน้าอนุมัติ)" />
      <Flash ok={sp.ok} error={sp.error} />

      {incoming.length > 0 && (
        <section className="mb-5 space-y-3">
          {incoming.map(({ s, req: a }) => (
            <div key={s.id} className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4 shadow-card">
              <p className="font-medium text-brand-900">{fullName(a)} ขอแลกเวรกับคุณ</p>
              <p className="text-sm text-stone-600">
                {s.requesterDate === s.partnerDate
                  ? `สลับกะกันวันที่ ${fmtDate(s.requesterDate)}`
                  : `คุณทำแทนวันที่ ${fmtDate(s.requesterDate)} · เขาทำแทนคุณวันที่ ${fmtDate(s.partnerDate)}`}
                {s.reason ? ` · ${s.reason}` : ""}
              </p>
              <form action={respondSwap} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={s.id} />
                <SubmitButton name="decision" value="accept" variant="success">
                  ตอบรับ
                </SubmitButton>
                <SubmitButton name="decision" value="decline" variant="secondary">
                  ปฏิเสธ
                </SubmitButton>
              </form>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {days.map(({ d, shift, changed }) => (
            <div key={d} className={cn("rounded-2xl border bg-white p-2 text-center shadow-card", d === today ? "border-brand-500" : "border-brand-200/80")}>
              <p className={cn("text-[11px]", isoWeekday(d) >= 6 || holiday.has(d) ? "text-rose-600" : "text-stone-500")}>
                {WEEKDAY_TH[isoWeekday(d)]} {Number(d.slice(8))}/{Number(d.slice(5, 7))}
              </p>
              <p className={cn("mt-1 rounded-lg py-1 text-sm font-semibold", shiftTone(shift), changed && "ring-1 ring-brand-500")} title={shift?.name}>
                {shiftShort(shift)}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          <Card title="ขอแลกเวร">
            {peers.length === 0 ? (
              <p className="text-sm text-stone-500">ไม่มีเพื่อนในแผนกที่แลกเวรได้</p>
            ) : (
              <form action={requestSwap} className="space-y-3">
                <div>
                  <span className="mb-1 block text-sm font-medium text-brand-800">แลกกับ</span>
                  <EmployeePicker name="partnerId" options={peers.map((p) => ({ id: p.id, code: p.code, name: fullName(p), nickname: p.nickname }))} />
                </div>
                <Field label="เวรของฉันวันที่">
                  <Input name="requesterDate" type="date" required min={today} defaultValue={today} />
                </Field>
                <Field label="แลกกับเวรของเพื่อนวันที่" hint="วันเดียวกัน = สลับกะกัน · คนละวัน = ทำแทนกัน">
                  <Input name="partnerDate" type="date" min={today} />
                </Field>
                <Field label="เหตุผล">
                  <Input name="reason" placeholder="เช่น ติดธุระครอบครัว" />
                </Field>
                <SubmitButton>ส่งคำขอแลกเวร</SubmitButton>
              </form>
            )}
          </Card>

          {swaps.length > 0 && (
            <Card title="ประวัติการแลกเวร">
              <ul className="divide-y divide-brand-100 text-sm">
                {swaps.map(({ s, req: a, par: b }) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block text-brand-900">{s.requesterId === me.id ? `กับ ${fullName(b)}` : `${fullName(a)} ขอแลก`}</span>
                      <span className="text-xs text-stone-500">
                        {fmtDate(s.requesterDate)}
                        {s.partnerDate !== s.requesterDate && ` ↔ ${fmtDate(s.partnerDate)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                      {s.requesterId === me.id && (s.status === "pending_partner" || s.status === "pending_head") && (
                        <form action={cancelSwap}>
                          <input type="hidden" name="id" value={s.id} />
                          <SubmitButton variant="ghost" confirm="ยกเลิกคำขอแลกเวร?">
                            ยกเลิก
                          </SubmitButton>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
