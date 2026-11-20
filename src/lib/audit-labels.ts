/** ป้ายภาษาไทยสำหรับประวัติการใช้งาน (audit_logs) */
export const AUDIT_ACTION: Record<string, string> = {
  login: "เข้าสู่ระบบ",
  login_failed: "เข้าสู่ระบบไม่สำเร็จ",
  login_locked: "ถูกล็อกชั่วคราว",
  unlock: "ปลดล็อกบัญชี",
  create: "สร้าง",
  update: "แก้ไข",
  update_with_password: "แก้ไข + ตั้งรหัสผ่านใหม่",
  delete: "ลบ",
  change_password: "เปลี่ยนรหัสผ่าน",
  register_device: "ลงทะเบียนมือถือ",
  reset_device: "รีเซ็ตอุปกรณ์สแกนนิ้ว",
  update_profile: "แก้ไขโปรไฟล์",
  update_photo: "เปลี่ยนรูปโปรไฟล์",
  remove_photo: "ลบรูปโปรไฟล์",
  salary_change: "เปลี่ยนเงินเดือน",
  manual_punch: "HR บันทึกเวลาแทน",
  delete_punch: "ลบรายการลงเวลา",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิกคำขอ",
  recalculate: "คำนวณเงินเดือนใหม่",
  adjust: "ปรับรายได้/รายหัก",
  finalize: "ปิดงวดเงินเดือน",
  reopen: "เปิดงวดเงินเดือนอีกครั้ง",
  enable_user: "เปิดใช้งานบัญชี",
  disable_user: "ระงับบัญชี",
  update_system: "แก้ไขการตั้งค่าระบบ",
  issue_warning: "ออกใบเตือน",
  acknowledge_warning: "รับทราบใบเตือน",
  void_warning: "ยกเลิกใบเตือน",
};

export const AUDIT_ENTITY: Record<string, string> = {
  user: "บัญชีผู้ใช้",
  employee: "พนักงาน",
  attendance: "การลงเวลา",
  request: "คำขอ",
  payroll_run: "งวดเงินเดือน",
  payroll_item: "รายการเงินเดือน",
  branch: "สาขา",
  department: "แผนก",
  position: "ตำแหน่ง",
  shift: "กะการทำงาน",
  holiday: "วันหยุด",
  leave_type: "ประเภทการลา",
  settings: "ตั้งค่าบริษัท",
  system: "ตั้งค่าระบบ",
  warning: "ใบเตือน",
};

/** โทนสีของป้าย: เรื่องความปลอดภัย/ลบ = แดง, เงิน = ทอง, เข้าระบบ = ฟ้า */
export function auditTone(action: string): "red" | "amber" | "gold" | "blue" | "green" | "gray" {
  if (["login_failed", "login_locked", "delete", "delete_punch", "disable_user", "reset_device", "rejected", "issue_warning"].includes(action)) return "red";
  if (["salary_change", "finalize", "reopen", "adjust", "recalculate"].includes(action)) return "gold";
  if (["login", "register_device", "enable_user", "approved", "unlock"].includes(action)) return action === "login" ? "blue" : "green";
  if (["change_password", "update_with_password", "update_system"].includes(action)) return "amber";
  return "gray";
}
