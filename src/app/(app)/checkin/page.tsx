import { and, asc, eq, gte, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { attendanceLogs, branches, employees, webauthnCredentials } from "@/db/schema";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { lastRecentPunch, nextPunchType } from "@/lib/punch";
import { addDays, atBkk, bkkDateStr, bkkTimeStr } from "@/lib/time";
import { cn } from "@/lib/util";
import { CheckinClient } from "./checkin-client";

export const metadata = { title: "สแกนนิ้วลงเวลา" };

export default async function CheckinPage() {
  const user = await requireUser();
  if (!user.employeeId) redirect("/?error=" + encodeURIComponent("บัญชีนี้ไม่ได้ผูกกับพนักงาน จึงลงเวลาไม่ได้"));
  const today = bkkDateStr();
  const last = await lastRecentPunch(user.employeeId);
  const next = nextPunchType(last);
  // แสดงรายการตั้งแต่ต้นวัน — หรือตั้งแต่ตอนสแกนเข้า ถ้าเข้างานตั้งแต่เมื่อวาน (กะข้ามวัน)
  const dayStart = atBkk(today);
  const listFrom = next === "out" && last && last.punchedAt < dayStart ? last.punchedAt : dayStart;

  const [creds, br, [emp], logs] = await Promise.all([
    db.select({ id: webauthnCredentials.id }).from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id)),
    db
      .select({ id: branches.id, name: branches.name, latitude: branches.latitude, longitude: branches.longitude, radiusM: branches.radiusM })
      .from(branches)
      .where(eq(branches.active, true)),
    db.select({ allowRemoteCheckin: employees.allowRemoteCheckin }).from(employees).where(eq(employees.id, user.employeeId)),
    db
      .select()
      .from(attendanceLogs)
      .where(and(eq(attendanceLogs.employeeId, user.employeeId), gte(attendanceLogs.punchedAt, listFrom), lt(attendanceLogs.punchedAt, atBkk(addDays(today, 1)))))
      .orderBy(asc(attendanceLogs.punchedAt)),
  ]);
  const lastIn = logs.findLast((l) => l.type === "in");
  const lastOut = logs.findLast((l) => l.type === "out");

  return (
    <div className="space-y-5">
      <CheckinClient
        registered={creds.length > 0}
        branches={br}
        allowRemote={emp?.allowRemoteCheckin ?? false}
        next={next}
        inAt={next === "out" && last ? bkkTimeStr(last.punchedAt) : null}
        doneToday={next === "in" && !!lastIn && !!lastOut && lastOut.punchedAt > lastIn.punchedAt ? { in: bkkTimeStr(lastIn.punchedAt), out: bkkTimeStr(lastOut.punchedAt) } : null}
      />
      <Card title="การลงเวลาวันนี้" className="mx-auto max-w-md">
        {logs.length === 0 ? (
          <p className="text-sm text-stone-500">ยังไม่มีการลงเวลา</p>
        ) : (
          <ol className="relative space-y-4 pl-1">
            {logs.map((l, i) => (
              <li key={l.id} className="relative flex items-center gap-3">
                {i < logs.length - 1 && <span className="absolute top-8 left-[15px] h-[calc(100%-8px)] w-px bg-brand-200" aria-hidden />}
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", l.type === "in" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                  <Icon name={l.type === "in" ? "logIn" : "logOut"} className="size-4" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[15px] font-medium text-brand-900">{l.type === "in" ? "เข้างาน" : "ออกงาน"}</span>
                  <span className="block text-xs text-stone-500">
                    {l.method === "biometric" ? (l.note ?? "สแกนนิ้ว") : l.method === "correction" ? "แก้ไขเวลา" : "HR บันทึก"}
                  </span>
                </span>
                <span className="text-lg font-semibold text-brand-900 tabular-nums">{bkkTimeStr(l.punchedAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
