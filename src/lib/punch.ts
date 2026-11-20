import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceLogs } from "@/db/schema";

/**
 * การสแกนเข้าที่ยังไม่ได้สแกนออก นับย้อนหลังกี่ชั่วโมง
 * ใช้ช่วงเวลาแทน "วันนี้" เพื่อให้กะข้ามวัน (เข้า 22:00 ออก 07:00) สแกนออกได้หลังเที่ยงคืน
 * ถ้าลืมสแกนออกเกินช่วงนี้ ระบบจะถือว่าเริ่มกะใหม่ (HR แก้เวลาที่ลืมได้ภายหลัง)
 */
export const OPEN_PUNCH_HOURS = 18;

/** รายการล่าสุดในช่วง OPEN_PUNCH_HOURS — ถ้าเป็น "in" แปลว่ากำลังทำงานอยู่ ต้องสแกนออก */
export async function lastRecentPunch(employeeId: number) {
  const [last] = await db
    .select({ type: attendanceLogs.type, punchedAt: attendanceLogs.punchedAt })
    .from(attendanceLogs)
    .where(and(eq(attendanceLogs.employeeId, employeeId), gte(attendanceLogs.punchedAt, new Date(Date.now() - OPEN_PUNCH_HOURS * 3_600_000))))
    .orderBy(desc(attendanceLogs.punchedAt))
    .limit(1);
  return last ?? null;
}

/** ขั้นถัดไป: ยังไม่ได้สแกนเข้า → "in" · สแกนเข้าแล้ว → "out" */
export function nextPunchType(last: { type: "in" | "out" } | null): "in" | "out" {
  return last?.type === "in" ? "out" : "in";
}
