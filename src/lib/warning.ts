import { addDays, bkkDateStr } from "./time";

export type WarningLevel = "verbal" | "written" | "final";
export const WARNING_LEVELS: WarningLevel[] = ["verbal", "written", "final"];

/** สีประจำระดับ (คงที่) — ชื่อ/ข้อความต่าง ๆ HR ตั้งได้ที่ ตั้งค่าองค์กร → ใบเตือน (lib/warning-config) */
export const WARNING_TONE: Record<WarningLevel, "gold" | "amber" | "red"> = { verbal: "gold", written: "amber", final: "red" };

/** ค่าเริ่มต้น (ใช้ตอนยังไม่เคยตั้งค่า) */
export const DEFAULT_LEVELS: Record<WarningLevel, { name: string; docTitle: string; description: string; validityMonths: number; closingText: string }> = {
  verbal: {
    name: "ตักเตือนด้วยวาจา",
    docTitle: "บันทึกการตักเตือนด้วยวาจา",
    description: "ความผิดเล็กน้อย บันทึกไว้เป็นประวัติ",
    validityMonths: 12,
    closingText: "บันทึกฉบับนี้จัดเก็บไว้ในประวัติของพนักงาน หากท่านกระทำความผิดในลักษณะเดียวกันอีก บริษัทฯ จะพิจารณาออกหนังสือเตือนต่อไป",
  },
  written: {
    name: "หนังสือเตือน",
    docTitle: "หนังสือเตือน",
    description: "เป็นลายลักษณ์อักษร มีผล 1 ปี",
    validityMonths: 12,
    closingText: "หากท่านกระทำความผิดซ้ำในเรื่องเดียวกันภายในระยะเวลาดังกล่าว บริษัทฯ จะพิจารณาลงโทษทางวินัยในขั้นที่สูงขึ้นต่อไป",
  },
  final: {
    name: "เตือนครั้งสุดท้าย",
    docTitle: "หนังสือเตือนครั้งสุดท้าย",
    description: "หากทำผิดซ้ำ อาจพิจารณาเลิกจ้าง",
    validityMonths: 12,
    closingText:
      "หากท่านกระทำความผิดซ้ำในเรื่องเดียวกันภายในระยะเวลาดังกล่าว บริษัทฯ มีสิทธิ์เลิกจ้างโดยไม่จ่ายค่าชดเชย ตามมาตรา 119 แห่งพระราชบัญญัติคุ้มครองแรงงาน พ.ศ. 2541",
  },
};

export const DEFAULT_CATEGORIES = ["มาสาย / ออกก่อนเวลา", "ขาดงานโดยไม่แจ้ง", "ไม่ปฏิบัติตามระเบียบบริษัท", "พฤติกรรมไม่เหมาะสม", "ประสิทธิภาพการทำงาน", "ความปลอดภัย / ดูแลผู้รับบริการ", "อื่น ๆ"];

/** วันหมดผล = วันเกิดเหตุ + n เดือน − 1 วัน (หนังสือเตือนตามกฎหมายมีผลไม่เกิน 1 ปี — ม.119(4)) */
export function validUntil(incidentDate: string, months = 12) {
  const [y, m, d] = incidentDate.split("-").map(Number);
  const t = y * 12 + (m - 1) + months;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate(); // กันวันที่ 31 ในเดือนที่มี 30 วัน
  return addDays(`${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`, -1);
}

type WarningLike = { incidentDate: string; validUntil?: string | null; voidedAt: Date | null; acknowledgedAt: Date | null };

/** วันหมดผลของใบนี้ (ใบเก่าที่ยังไม่มีค่าเก็บไว้ = 1 ปี) */
export const effectiveUntil = (w: Pick<WarningLike, "incidentDate" | "validUntil">) => w.validUntil ?? validUntil(w.incidentDate);

export type WarningStatus = "voided" | "expired" | "pending" | "acknowledged";

export function warningStatus(w: WarningLike, today = bkkDateStr()): WarningStatus {
  if (w.voidedAt) return "voided";
  if (effectiveUntil(w) < today) return "expired";
  return w.acknowledgedAt ? "acknowledged" : "pending";
}

export const WARNING_STATUS: Record<WarningStatus, { label: string; tone: "gray" | "amber" | "green" | "blue" }> = {
  pending: { label: "รอพนักงานรับทราบ", tone: "amber" },
  acknowledged: { label: "รับทราบแล้ว", tone: "green" },
  expired: { label: "พ้นกำหนดแล้ว", tone: "gray" },
  voided: { label: "ยกเลิกแล้ว", tone: "gray" },
};

/** ใบเตือนที่ยังมีผล (ไม่ถูกยกเลิก และยังไม่พ้นกำหนด) */
export const isActiveWarning = (w: WarningLike, today?: string) => {
  const s = warningStatus(w, today);
  return s === "pending" || s === "acknowledged";
};
