/** เวลาทั้งหมดในระบบคิดตามเวลาประเทศไทย (UTC+7, ไม่มี DST) — Vercel รันเป็น UTC จึงห้ามใช้ new Date().getDate() ตรง ๆ */
export const TZ = "Asia/Bangkok";
const OFFSET = "+07:00";

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

/** "YYYY-MM-DD" ตามเวลาไทย */
export function bkkDateStr(d: Date = new Date()): string {
  return dateFmt.format(d);
}

/** "HH:MM" ตามเวลาไทย */
export function bkkTimeStr(d: Date): string {
  return timeFmt.format(d);
}

/** สร้าง Date จากวันที่ + เวลา (เวลาไทย) */
export function atBkk(dateStr: string, time = "00:00"): Date {
  return new Date(`${dateStr}T${time.length === 5 ? `${time}:00` : time}${OFFSET}`);
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1 = จันทร์ ... 7 = อาทิตย์ */
export function isoWeekday(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end, days: last };
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}

const thDate = new Intl.DateTimeFormat("th-TH", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const thDateTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const thMonth = new Intl.DateTimeFormat("th-TH", { timeZone: TZ, month: "long", year: "numeric" });

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return thDate.format(typeof d === "string" ? atBkk(d, "12:00") : d);
}
export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return thDateTime.format(typeof d === "string" ? new Date(d) : d);
}
export function fmtMonth(year: number, month: number): string {
  return thMonth.format(atBkk(`${year}-${String(month).padStart(2, "0")}-15`, "12:00"));
}

export const WEEKDAY_TH = ["", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
