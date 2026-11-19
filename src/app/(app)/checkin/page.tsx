import { and, asc, eq, gte, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { attendanceLogs, branches, employees, webauthnCredentials } from "@/db/schema";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { addDays, atBkk, bkkDateStr, bkkTimeStr } from "@/lib/time";
import { CheckinClient } from "./checkin-client";

export const metadata = { title: "สแกนนิ้วลงเวลา" };

export default async function CheckinPage() {
  const user = await requireUser();
  if (!user.employeeId) redirect("/?error=" + encodeURIComponent("บัญชีนี้ไม่ได้ผูกกับพนักงาน จึงลงเวลาไม่ได้"));
  const today = bkkDateStr();
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
      .where(
        and(
          eq(attendanceLogs.employeeId, user.employeeId),
          gte(attendanceLogs.punchedAt, atBkk(today)),
          lt(attendanceLogs.punchedAt, atBkk(addDays(today, 1))),
        ),
      )
      .orderBy(asc(attendanceLogs.punchedAt)),
  ]);
  const suggested = logs.at(-1)?.type === "in" ? "out" : "in";

  return (
    <div className="space-y-5">
      <CheckinClient registered={creds.length > 0} branches={br} allowRemote={emp?.allowRemoteCheckin ?? false} suggested={suggested} />
      <Card title="วันนี้" className="mx-auto max-w-md">
        {logs.length === 0 ? (
          <p className="text-sm text-stone-500">ยังไม่มีการลงเวลา</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2">
                <Badge tone={l.type === "in" ? "green" : "red"}>{l.type === "in" ? "เข้างาน" : "ออกงาน"}</Badge>
                <span className="font-medium tabular-nums">{bkkTimeStr(l.punchedAt)} น.</span>
                <span className="text-xs text-stone-400">{l.method === "biometric" ? (l.note ?? "สแกนนิ้ว") : l.method === "correction" ? "แก้ไขเวลา" : "HR บันทึก"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
