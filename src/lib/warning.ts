import { addDays, bkkDateStr } from "./time";

export type WarningLevel = "verbal" | "written" | "final";

export const WARNING_LEVEL: Record<WarningLevel, { label: string; short: string; tone: "amber" | "red" | "gold" }> = {
  verbal: { label: "ตักเตือนด้วยวาจา (บันทึกไว้)", short: "ตักเตือนด้วยวาจา", tone: "gold" },
  written: { label: "หนังสือเตือน", short: "หนังสือเตือน", tone: "amber" },
  final: { label: "หนังสือเตือนครั้งสุดท้าย", short: "เตือนครั้งสุดท้าย", tone: "red" },
};

export const WARNING_CATEGORIES = ["มาสาย / ออกก่อนเวลา", "ขาดงานโดยไม่แจ้ง", "ไม่ปฏิบัติตามระเบียบบริษัท", "พฤติกรรมไม่เหมาะสม", "ประสิทธิภาพการทำงาน", "ความปลอดภัย / ดูแลผู้รับบริการ", "อื่น ๆ"];

/**
 * หนังสือเตือนมีผล 1 ปีนับแต่วันที่กระทำผิด (พ.ร.บ.คุ้มครองแรงงาน ม.119(4))
 * ใช้ช่วงเดียวกันกับการตักเตือนด้วยวาจาเพื่อดูประวัติย้อนหลัง
 */
export function validUntil(incidentDate: string) {
  const [y, m, d] = incidentDate.split("-").map(Number);
  return addDays(`${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, -1);
}

export type WarningStatus = "voided" | "expired" | "pending" | "acknowledged";

export function warningStatus(w: { incidentDate: string; voidedAt: Date | null; acknowledgedAt: Date | null }, today = bkkDateStr()): WarningStatus {
  if (w.voidedAt) return "voided";
  if (validUntil(w.incidentDate) < today) return "expired";
  return w.acknowledgedAt ? "acknowledged" : "pending";
}

export const WARNING_STATUS: Record<WarningStatus, { label: string; tone: "gray" | "amber" | "green" | "blue" }> = {
  pending: { label: "รอพนักงานรับทราบ", tone: "amber" },
  acknowledged: { label: "รับทราบแล้ว", tone: "green" },
  expired: { label: "พ้นกำหนด 1 ปี", tone: "gray" },
  voided: { label: "ยกเลิกแล้ว", tone: "gray" },
};

/** ใบเตือนที่ยังมีผล (ไม่ถูกยกเลิก และยังไม่พ้น 1 ปี) */
export const isActiveWarning = (w: Parameters<typeof warningStatus>[0], today?: string) => {
  const s = warningStatus(w, today);
  return s === "pending" || s === "acknowledged";
};
