import { and, eq, gte, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { companySettings, employeeLicenses, employees, requests } from "@/db/schema";
import { pendingWithStage } from "./approval";
import { loadAttendance } from "./attendance-data";
import { LICENSE_REMIND_DAYS } from "./license";
import { hrUserIds, notify, userIdsOfEmployees } from "./notify";
import { addDays, bkkDateStr, fmtDate } from "./time";
import { fullName, REQUEST_TYPE_LABEL } from "./util";

/** คำขอค้างที่หัวหน้านานกว่านี้ → แจ้ง HR */
const STALE_DAYS = 2;

/**
 * งานประจำวัน (รันวันละครั้ง ~08:00 น.)
 *  1) สรุปคำขอรออนุมัติให้ผู้อนุมัติแต่ละคน + แจ้ง HR เมื่อคำขอค้างที่หัวหน้าเกิน 2 วัน
 *  2) เตือนใบอนุญาต/ใบรับรองใกล้หมดอายุ (60 / 30 / 7 / วันหมดอายุ)
 *  3) เตือนพนักงานที่เมื่อวานสแกนเข้าแต่ไม่ได้สแกนออก ให้ขอแก้เวลา
 * กันรันซ้ำ: จองวันที่ใน company_settings แบบอะตอมมิก — ถ้าวันนี้รันไปแล้วจะไม่ทำซ้ำ
 */
export async function runDailyJobs(opts: { force?: boolean } = {}) {
  const today = bkkDateStr();
  const claimed = await db
    .update(companySettings)
    .set({ dailyJobDate: today })
    .where(and(eq(companySettings.id, 1), opts.force ? undefined : or(sql`${companySettings.dailyJobDate} is null`, sql`${companySettings.dailyJobDate} < ${today}`)))
    .returning({ id: companySettings.id });
  if (!claimed.length) return { skipped: true as const };

  const [approvals, licenses, scanOut] = await Promise.all([remindApprovals(), remindLicenses(today), remindMissingScanOut(today)]);
  return { skipped: false as const, approvals, licenses, scanOut };
}

let checkedOn = "";
/** เรียกจากหน้าเว็บ (หลังส่งหน้าเสร็จ) — สำรองกรณี cron ไม่ได้ตั้ง: หลัง 08:00 คนแรกที่เปิดเว็บจะทำให้งานประจำวันรัน */
export async function maybeRunDailyJobs() {
  const today = bkkDateStr();
  if (checkedOn === today) return;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" }).format(new Date()));
  if (hour < 8) return;
  checkedOn = today;
  try {
    await runDailyJobs();
  } catch (e) {
    checkedOn = "";
    console.error("[daily-jobs]", e);
  }
}

/* --------------------------- 1) คำขอรออนุมัติ --------------------------- */
async function remindApprovals() {
  const all = await pendingWithStage();
  if (!all.length) return 0;
  const hr = await hrUserIds();
  const empUser = await userIdsOfEmployees([...new Set(all.flatMap((x) => [x.headId, x.actingId]).filter((v): v is number => !!v))]);

  // นับว่าแต่ละคนมีคำขอรอตัดสินกี่รายการ
  const countBy = new Map<number, number>();
  const add = (uid: number | undefined) => uid && countBy.set(uid, (countBy.get(uid) ?? 0) + 1);
  for (const x of all) {
    if (x.stage === "head") {
      add(empUser.get(x.headId!));
      if (x.actingId) add(empUser.get(x.actingId));
    } else for (const h of hr) if (h !== empUser.get(x.e.id)) add(h);
  }
  for (const [uid, n] of countBy)
    await notify([uid], { kind: "request_new", title: `มีคำขอรอคุณอนุมัติ ${n} รายการ`, body: "สรุปประจำเช้า · ลา OT แก้เวลา", href: "/requests/inbox" });

  // ค้างที่หัวหน้าเกิน 2 วัน → แจ้ง HR พร้อมชื่อหัวหน้า
  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);
  const stale = all.filter((x) => x.stage === "head" && x.r.createdAt < cutoff);
  if (stale.length) {
    const heads = await db
      .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName })
      .from(employees)
      .where(inArray(employees.id, [...new Set(stale.map((x) => x.headId!))]));
    const name = new Map(heads.map((h) => [h.id, `${h.firstName} ${h.lastName}`]));
    const byHead = new Map<string, number>();
    for (const x of stale) byHead.set(name.get(x.headId!) ?? "-", (byHead.get(name.get(x.headId!) ?? "-") ?? 0) + 1);
    await notify(hr, {
      kind: "request_new",
      title: `คำขอค้างที่หัวหน้าเกิน ${STALE_DAYS} วัน: ${stale.length} รายการ`,
      body: [...byHead].map(([h, n]) => `${h} ${n} รายการ`).join(" · "),
      href: "/requests/inbox",
    });
    // เตือนหัวหน้าซ้ำแบบเจาะจง
    for (const x of stale) {
      const uid = empUser.get(x.headId!);
      if (uid)
        await notify([uid], {
          kind: "request_new",
          title: `คำขอของ ${fullName(x.e)} รอคุณเกิน ${STALE_DAYS} วันแล้ว`,
          body: `${REQUEST_TYPE_LABEL[x.r.type]} · ยื่นเมื่อ ${fmtDate(x.r.createdAt)}`,
          href: "/requests/inbox",
        });
    }
  }
  return countBy.size;
}

/* ----------------------- 2) ใบอนุญาตใกล้หมดอายุ ----------------------- */
async function remindLicenses(today: string) {
  const targets = LICENSE_REMIND_DAYS.map((d) => addDays(today, d));
  const rows = await db
    .select({ l: employeeLicenses, e: employees })
    .from(employeeLicenses)
    .innerJoin(employees, eq(employeeLicenses.employeeId, employees.id))
    .where(and(isNotNull(employeeLicenses.expiresAt), inArray(employeeLicenses.expiresAt, targets), ne(employees.status, "resigned")));
  if (!rows.length) return 0;
  const hr = await hrUserIds();
  const userOf = await userIdsOfEmployees(rows.map((r) => r.e.id));
  for (const { l, e } of rows) {
    const days = Math.round((Date.parse(l.expiresAt!) - Date.parse(today)) / 86_400_000);
    const when = days === 0 ? "หมดอายุวันนี้" : `จะหมดอายุในอีก ${days} วัน (${fmtDate(l.expiresAt)})`;
    const self = userOf.get(e.id);
    if (self) await notify([self], { kind: "system", title: `${l.name} ${when}`, body: "กรุณาต่ออายุและส่งสำเนาให้ฝ่ายบุคคล", href: "/account" });
    await notify(hr, { kind: "system", title: `ใบอนุญาตใกล้หมดอายุ: ${fullName(e)}`, body: `${l.name} ${when}`, href: `/personnel/${e.id}#licenses` });
  }
  return rows.length;
}

/* ------------------------- 3) ลืมสแกนออกเมื่อวาน ------------------------ */
async function remindMissingScanOut(today: string) {
  const y = addDays(today, -1);
  const att = await loadAttendance({ start: y, end: y });
  const missing = att.filter((a) => a.days[0]?.firstIn && !a.days[0]?.lastOut).map((a) => a.employee);
  if (!missing.length) return 0;
  // ข้ามคนที่ยื่นขอแก้เวลาวันนั้นไว้แล้ว
  const already = await db
    .select({ employeeId: requests.employeeId })
    .from(requests)
    .where(
      and(
        eq(requests.type, "time_correction"),
        inArray(
          requests.employeeId,
          missing.map((e) => e.id),
        ),
        gte(requests.correctionAt, new Date(`${y}T00:00:00+07:00`)),
        lte(requests.correctionAt, new Date(`${today}T12:00:00+07:00`)),
      ),
    );
  const skip = new Set(already.map((a) => a.employeeId));
  const userOf = await userIdsOfEmployees(missing.map((e) => e.id));
  let n = 0;
  for (const e of missing) {
    const uid = userOf.get(e.id);
    if (!uid || skip.has(e.id)) continue;
    await notify([uid], {
      kind: "system",
      title: `เมื่อวาน (${fmtDate(y)}) ไม่ได้สแกนออก`,
      body: "กดเพื่อยื่นขอแก้ไขเวลาออก",
      href: `/requests/new?type=time_correction&kind=out&date=${y}`,
    });
    n++;
  }
  return n;
}
