import { and, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { shiftAssignments, shifts, type Shift } from "@/db/schema";
import { isWorkDay } from "./attendance";

/** ตารางเวร: Map<employeeId, Map<date, shiftId | null>> — null = หยุด */
export type RosterMap = Map<number, Map<string, number | null>>;

export async function loadRoster(start: string, end: string, employeeIds?: number[]): Promise<RosterMap> {
  if (employeeIds && !employeeIds.length) return new Map();
  const rows = await db
    .select({ employeeId: shiftAssignments.employeeId, date: shiftAssignments.date, shiftId: shiftAssignments.shiftId })
    .from(shiftAssignments)
    .where(and(gte(shiftAssignments.date, start), lte(shiftAssignments.date, end), employeeIds ? inArray(shiftAssignments.employeeId, employeeIds) : undefined));
  const out: RosterMap = new Map();
  for (const r of rows) {
    if (!out.has(r.employeeId)) out.set(r.employeeId, new Map());
    out.get(r.employeeId)!.set(r.date, r.shiftId);
  }
  return out;
}

export async function shiftsById() {
  return new Map((await db.select().from(shifts)).map((s) => [s.id, s]));
}

/** กะที่ต้องทำจริงวันนั้น: ตามตารางเวร (ถ้ามี) มิฉะนั้นตามกะประจำ — null = วันหยุด */
export function effectiveShiftId(emp: { id: number; shiftId: number | null }, date: string, roster: RosterMap, byId: Map<number, Shift>): number | null {
  const r = roster.get(emp.id);
  if (r?.has(date)) return r.get(date) ?? null;
  const s = emp.shiftId ? byId.get(emp.shiftId) : undefined;
  return s && isWorkDay(date, s) ? s.id : null;
}

/** ป้ายสั้นของกะ เช่น 08-17, 19-07 */
export function shiftShort(s: { startTime: string; endTime: string } | undefined | null) {
  return s ? `${s.startTime.slice(0, 2)}-${s.endTime.slice(0, 2)}` : "หยุด";
}

/** สีประจำกะ (กะดึก = ม่วง, กะเช้ายาว = ฟ้า, กะปกติ = เขียว) */
export function shiftTone(s: { startTime: string; endTime: string } | undefined | null) {
  if (!s) return "bg-stone-100 text-stone-500";
  if (s.endTime <= s.startTime) return "bg-violet-100 text-violet-800";
  if (s.startTime < "08:00") return "bg-sky-100 text-sky-800";
  return "bg-emerald-100 text-emerald-800";
}
