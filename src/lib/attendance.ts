import { addDays, atBkk, bkkDateStr, eachDate, isoWeekday, minutesBetween } from "./time";

export type ShiftLike = {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  lateGraceMinutes: number;
  workDays: string;
};

export const DEFAULT_SHIFT: ShiftLike = { startTime: "08:00", endTime: "17:00", breakMinutes: 60, lateGraceMinutes: 0, workDays: "1,2,3,4,5" };

export type Punch = { type: "in" | "out"; punchedAt: Date };
export type LeaveSpan = { startDate: string; endDate: string; days: number; paid: boolean; name: string };

export type DayStatus = "present" | "late" | "incomplete" | "absent" | "leave" | "holiday" | "off" | "future" | "not_employed";

export type DayRecord = {
  date: string;
  /** ตรงกับวันทำงานของกะ (ไม่สนวันหยุดนักขัตฯ) */
  workDay: boolean;
  /** วันที่ต้องมาทำงานจริง = วันทำงานของกะ และไม่ใช่วันหยุดนักขัตฯ */
  scheduled: boolean;
  holiday?: string;
  leave?: { name: string; paid: boolean; portion: number };
  firstIn?: Date;
  lastOut?: Date;
  lateMinutes: number;
  earlyMinutes: number;
  workedMinutes: number;
  status: DayStatus;
};

export function shiftWindow(date: string, shift: ShiftLike) {
  const start = atBkk(date, shift.startTime);
  const crosses = shift.endTime <= shift.startTime;
  const end = atBkk(crosses ? addDays(date, 1) : date, shift.endTime);
  // หน้าต่างที่นับว่าเป็นการลงเวลาของกะนี้: ก่อนเข้างาน 4 ชม. ถึงหลังเลิกงาน 6 ชม.
  return { start, end, from: new Date(start.getTime() - 4 * 3600_000), to: new Date(end.getTime() + 6 * 3600_000) };
}

export function isWorkDay(date: string, shift: ShiftLike) {
  return shift.workDays.split(",").map(Number).includes(isoWeekday(date));
}

/** สรุปเวลารายวันของพนักงาน 1 คน */
export function summarizeDays(opts: {
  start: string;
  end: string;
  shift: ShiftLike | null;
  punches: Punch[];
  holidays: Map<string, string>;
  leaves: LeaveSpan[];
  employedFrom?: string | null;
  employedTo?: string | null;
  now?: Date;
  /** ตารางเวรรายวัน: มีวันนั้น = ใช้กะนี้ (null = หยุด) แทนกะประจำ */
  roster?: Map<string, ShiftLike | null>;
}): DayRecord[] {
  const baseShift = opts.shift ?? DEFAULT_SHIFT;
  const shiftOn = (d: string): ShiftLike | null => (opts.roster?.has(d) ? (opts.roster.get(d) ?? null) : isWorkDay(d, baseShift) ? baseShift : null);
  const now = opts.now ?? new Date();
  const today = bkkDateStr(now);

  // คิดสัดส่วนวันลาต่อวัน (เช่น ลาครึ่งวัน 0.5)
  const leaveByDate = new Map<string, { name: string; paid: boolean; portion: number }>();
  for (const l of opts.leaves) {
    const dates = eachDate(l.startDate, l.endDate).filter((d) => shiftOn(d) && !opts.holidays.has(d));
    if (!dates.length) continue;
    const portion = Math.min(1, l.days / dates.length);
    for (const d of dates) leaveByDate.set(d, { name: l.name, paid: l.paid, portion });
  }

  return eachDate(opts.start, opts.end).map((date): DayRecord => {
    const shift = shiftOn(date) ?? baseShift;
    const base: DayRecord = { date, workDay: !!shiftOn(date), scheduled: false, lateMinutes: 0, earlyMinutes: 0, workedMinutes: 0, status: "off" };
    if ((opts.employedFrom && date < opts.employedFrom) || (opts.employedTo && date > opts.employedTo)) {
      return { ...base, status: "not_employed" };
    }
    const w = shiftWindow(date, shift);
    const inWin = opts.punches.filter((p) => p.punchedAt >= w.from && p.punchedAt <= w.to);
    const ins = inWin.filter((p) => p.type === "in").map((p) => p.punchedAt);
    const outs = inWin.filter((p) => p.type === "out").map((p) => p.punchedAt);
    const firstIn = ins.length ? new Date(Math.min(...ins.map(Number))) : undefined;
    const lastOut = outs.length ? new Date(Math.max(...outs.map(Number))) : undefined;

    const holiday = opts.holidays.get(date);
    const scheduled = base.workDay && !holiday;
    const leave = leaveByDate.get(date);
    const rec: DayRecord = { ...base, scheduled, holiday, leave, firstIn, lastOut };

    if (firstIn && lastOut && lastOut > firstIn) {
      rec.workedMinutes = Math.max(0, minutesBetween(firstIn, lastOut) - shift.breakMinutes);
    }
    if (!scheduled) {
      rec.status = holiday ? "holiday" : "off";
      return rec;
    }
    if (leave && leave.portion >= 1) {
      rec.status = "leave";
      return rec;
    }
    if (firstIn) {
      const late = minutesBetween(w.start, firstIn);
      if (late > shift.lateGraceMinutes && !(leave && leave.portion > 0)) rec.lateMinutes = late;
    }
    if (lastOut && lastOut < w.end && !(leave && leave.portion > 0)) {
      rec.earlyMinutes = minutesBetween(lastOut, w.end);
    }
    if (!firstIn && !lastOut) {
      rec.status = date > today || (date === today && now < w.end) ? "future" : leave ? "leave" : "absent";
      return rec;
    }
    if (!firstIn || !lastOut) rec.status = date === today && now < w.to ? (rec.lateMinutes ? "late" : "present") : "incomplete";
    else rec.status = rec.lateMinutes ? "late" : "present";
    return rec;
  });
}

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  present: "มาทำงาน",
  late: "มาสาย",
  incomplete: "ลงเวลาไม่ครบ",
  absent: "ขาดงาน",
  leave: "ลา",
  holiday: "วันหยุดนักขัตฯ",
  off: "วันหยุด",
  future: "-",
  not_employed: "-",
};

export function totals(days: DayRecord[]) {
  let scheduled = 0,
    worked = 0,
    absent = 0,
    lateCount = 0,
    lateMinutes = 0,
    paidLeave = 0,
    unpaidLeave = 0,
    paidHolidays = 0,
    incomplete = 0;
  for (const d of days) {
    if (d.status === "not_employed") continue;
    if (d.holiday && d.workDay) paidHolidays++;
    if (!d.scheduled) continue;
    scheduled++;
    if (d.leave) d.leave.paid ? (paidLeave += d.leave.portion) : (unpaidLeave += d.leave.portion);
    if (d.status === "present" || d.status === "late" || d.status === "incomplete") worked++;
    if (d.status === "incomplete") incomplete++;
    if (d.status === "absent") absent++;
    if (d.lateMinutes > 0) {
      lateCount++;
      lateMinutes += d.lateMinutes;
    }
  }
  return { scheduled, worked, absent, lateCount, lateMinutes, paidLeave, unpaidLeave, paidHolidays, incomplete };
}
