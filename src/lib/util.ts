import Decimal from "decimal.js";

const moneyFmt = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtMoney(v: string | number | Decimal | null | undefined): string {
  if (v === null || v === undefined || v === "") return "-";
  return moneyFmt.format(Number(v instanceof Decimal ? v.toString() : v));
}

export function cn(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(" ");
}

export function fullName(e: { prefix?: string | null; firstName: string; lastName: string }): string {
  return `${e.prefix ?? ""}${e.firstName} ${e.lastName}`.trim();
}

/** สร้าง URL พร้อมข้อความแจ้งผล ใช้กับ redirect() หลัง server action */
export function withMsg(path: string, msg: { ok?: string; error?: string }): string {
  const [base, qs] = path.split("?");
  const p = new URLSearchParams(qs);
  p.delete("ok");
  p.delete("error");
  if (msg.ok) p.set("ok", msg.ok);
  if (msg.error) p.set("error", msg.error);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

export const ROLE_LABEL = { admin: "ผู้ดูแลระบบ", hr: "HR", manager: "หัวหน้างาน", employee: "พนักงาน" } as const;
export const STATUS_LABEL = { probation: "ทดลองงาน", active: "พนักงานประจำ", resigned: "ลาออก" } as const;
export const REQUEST_TYPE_LABEL = { leave: "ลางาน", ot: "ขอทำ OT", time_correction: "ขอแก้ไขเวลา" } as const;
export const REQUEST_STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติ", rejected: "ไม่อนุมัติ", cancelled: "ยกเลิก" } as const;
