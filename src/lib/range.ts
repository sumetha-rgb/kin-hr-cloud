import { addDays, bkkDateStr, fmtDate, isoWeekday, WEEKDAY_TH } from "./time";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type DateRange = {
  from: string;
  to: string;
  /** เลือกวันเดียว */
  single: boolean;
  today: string;
  days: number;
  /** ช่วงก่อนหน้า/ถัดไปที่ยาวเท่ากัน (สำหรับปุ่ม ‹ ›) */
  prev: { from: string; to: string };
  next: { from: string; to: string };
  label: string;
};

function dayCount(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function rangeLabel(from: string, to: string) {
  if (from === to) return `${WEEKDAY_TH[isoWeekday(from)]} ${fmtDate(from)}`;
  const [a, b] = [fmtDate(from), fmtDate(to)];
  // ปีเดียวกัน → ตัดปีของวันแรกออก ให้สั้นลง (1 พ.ย. – 19 พ.ย. 2569)
  const ya = a.split(" ").at(-1);
  return ya === b.split(" ").at(-1) ? `${a.replace(` ${ya}`, "")} – ${b}` : `${a} – ${b}`;
}

/**
 * อ่านช่วงวันที่จาก query: ?from=&to= (ช่วง) หรือ ?date= (วันเดียว) — ไม่ระบุ = วันนี้
 * จำกัดความยาวสูงสุด maxDays เพื่อไม่ให้คำนวณหนักเกินไป
 */
export function parseRange(sp: { date?: string; from?: string; to?: string }, maxDays = 92): DateRange {
  const today = bkkDateStr();
  let from = today;
  let to = today;
  if (sp.from && ISO.test(sp.from)) {
    from = sp.from;
    to = sp.to && ISO.test(sp.to) ? sp.to : sp.from;
  } else if (sp.date && ISO.test(sp.date)) {
    from = to = sp.date;
  }
  if (to < from) [from, to] = [to, from];
  if (dayCount(from, to) > maxDays) to = addDays(from, maxDays - 1);
  const days = dayCount(from, to);
  return {
    from,
    to,
    single: from === to,
    today,
    days,
    prev: { from: addDays(from, -days), to: addDays(from, -1) },
    next: { from: addDays(to, 1), to: addDays(to, days) },
    label: rangeLabel(from, to),
  };
}
