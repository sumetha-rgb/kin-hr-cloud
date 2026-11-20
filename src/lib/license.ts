import { addDays, bkkDateStr } from "./time";

/** แจ้งเตือนล่วงหน้ากี่วันก่อนหมดอายุ */
export const LICENSE_REMIND_DAYS = [60, 30, 7, 0] as const;

/** ชื่อใบอนุญาตที่ใช้บ่อย (เลือกได้หรือพิมพ์เอง) */
export const LICENSE_PRESETS = [
  "ใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์",
  "ใบอนุญาตประกอบวิชาชีพกายภาพบำบัด",
  "ใบรับรองผู้ช่วยพยาบาล",
  "ใบรับรองผู้ดูแลผู้สูงอายุ (Caregiver)",
  "CPR / BLS",
  "ใบขับขี่",
];

export type LicenseStatus = { key: "none" | "ok" | "soon" | "urgent" | "expired"; label: string; tone: "gray" | "green" | "amber" | "red"; days: number | null };

/** สถานะใบอนุญาตจากวันหมดอายุ: เหลือ ≤ 30 วัน = ใกล้หมด, ≤ 7 วัน = ด่วน */
export function licenseStatus(expiresAt: string | null, today = bkkDateStr()): LicenseStatus {
  if (!expiresAt) return { key: "none", label: "ไม่มีวันหมดอายุ", tone: "gray", days: null };
  const days = Math.round((Date.parse(expiresAt) - Date.parse(today)) / 86_400_000);
  if (days < 0) return { key: "expired", label: `หมดอายุแล้ว ${-days} วัน`, tone: "red", days };
  if (days <= 7) return { key: "urgent", label: days === 0 ? "หมดอายุวันนี้" : `เหลือ ${days} วัน`, tone: "red", days };
  if (days <= 60) return { key: "soon", label: `เหลือ ${days} วัน`, tone: "amber", days };
  return { key: "ok", label: "ใช้ได้", tone: "green", days };
}

/** วันที่ที่ต้องเตือน (วันหมดอายุ − 60/30/7/0) */
export function remindDates(expiresAt: string) {
  return LICENSE_REMIND_DAYS.map((d) => ({ days: d, date: addDays(expiresAt, -d) }));
}
