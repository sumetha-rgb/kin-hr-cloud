import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 12, scale: 2 }).notNull().default("0");
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ---------------------------------- Enums --------------------------------- */
export const roleEnum = pgEnum("role", ["admin", "hr", "manager", "employee"]);
export const employeeStatusEnum = pgEnum("employee_status", ["probation", "active", "resigned"]);
export const payTypeEnum = pgEnum("pay_type", ["monthly", "daily"]);
export const punchTypeEnum = pgEnum("punch_type", ["in", "out"]);
export const punchMethodEnum = pgEnum("punch_method", ["biometric", "manual", "correction"]);
export const requestTypeEnum = pgEnum("request_type", ["leave", "ot", "time_correction"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected", "cancelled"]);
export const payrollStatusEnum = pgEnum("payroll_status", ["draft", "finalized"]);

/* ------------------------------ Organization ------------------------------ */
export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull().default("บริษัทของฉัน"),
  taxId: text("tax_id"),
  address: text("address"),
  ssoRate: numeric("sso_rate", { precision: 5, scale: 2 }).notNull().default("5.00"),
  ssoMinBase: money("sso_min_base"),
  ssoMaxBase: money("sso_max_base"),
  deductLate: boolean("deduct_late").notNull().default(true),
  maxGpsAccuracyM: integer("max_gps_accuracy_m").notNull().default(150),
  // ตั้งค่าระบบ (หน้า ดูแลระบบ)
  demoLogin: boolean("demo_login").notNull().default(true), // แสดงปุ่มบัญชีทดลองที่หน้า login
  selfProfileEdit: boolean("self_profile_edit").notNull().default(true), // พนักงานแก้โปรไฟล์/รูปของตัวเองได้
  announcement: text("announcement"), // ประกาศถึงพนักงาน แสดงที่หน้าหลัก
  // กุญแจ Web Push (VAPID) — ระบบสร้างให้เองครั้งแรกที่ใช้ ไม่ต้องตั้งใน Vercel
  vapidPublicKey: text("vapid_public_key"),
  vapidPrivateKey: text("vapid_private_key"),
  // งานประจำวัน (เตือนคำขอค้าง ใบอนุญาตใกล้หมดอายุ ลืมสแกนออก) — กันรันซ้ำในวันเดียวกัน
  dailyJobDate: date("daily_job_date"),
  // วันที่จ่ายเงินเดือน (ใช้ในไฟล์โอนเงิน/ภ.ง.ด.1)
  payDay: integer("pay_day").notNull().default(25),
  ssoEmployerNo: text("sso_employer_no"), // เลขที่บัญชีนายจ้าง ประกันสังคม
  ssoBranchNo: text("sso_branch_no").default("000000"),
  // ผู้ลงนามในสัญญาจ้าง
  employerRepName: text("employer_rep_name"), // ผู้มีอำนาจลงนามแทนนายจ้าง
  employerRepTitle: text("employer_rep_title"), // เช่น ประธานกรรมการบริหาร
  hrHeadName: text("hr_head_name"), // หัวหน้าฝ่ายบุคคล
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  radiusM: integer("radius_m").notNull().default(150),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => departments.id, { onDelete: "set null" }),
  // หัวหน้าแผนก: อนุมัติคำขอของคนในแผนกเป็นขั้นแรก (ลา/แก้เวลา → แล้วส่ง HR · OT → จบที่หัวหน้า)
  headEmployeeId: integer("head_employee_id").references((): AnyPgColumn => employees.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** กะการทำงาน: workDays = "1,2,3,4,5" (1=จันทร์ ... 7=อาทิตย์) */
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(), // "08:00"
  endTime: text("end_time").notNull(), // "17:00" (น้อยกว่า start = ข้ามเที่ยงคืน)
  breakMinutes: integer("break_minutes").notNull().default(60),
  lateGraceMinutes: integer("late_grace_minutes").notNull().default(0),
  workDays: text("work_days").notNull().default("1,2,3,4,5"),
  createdAt: createdAt(),
});

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  name: text("name").notNull(),
});

export const leaveTypes = pgTable("leave_types", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  paid: boolean("paid").notNull().default(true),
  daysPerYear: integer("days_per_year").notNull().default(0),
});

/* -------------------------------- Personnel ------------------------------- */
export const employees = pgTable(
  "employees",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    prefix: text("prefix"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    nickname: text("nickname"),
    nationalId: text("national_id"),
    phone: text("phone"),
    email: text("email"),
    birthDate: date("birth_date"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    status: employeeStatusEnum("status").notNull().default("probation"),
    branchId: integer("branch_id").references(() => branches.id, { onDelete: "set null" }),
    departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
    positionId: integer("position_id").references(() => positions.id, { onDelete: "set null" }),
    shiftId: integer("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    managerId: integer("manager_id").references((): AnyPgColumn => employees.id, { onDelete: "set null" }),
    payType: payTypeEnum("pay_type").notNull().default("monthly"),
    baseSalary: money("base_salary"), // รายเดือน = เงินเดือน, รายวัน = ค่าแรงต่อวัน
    monthlyAllowance: money("monthly_allowance"),
    extraTaxAllowance: money("extra_tax_allowance"), // ค่าลดหย่อนเพิ่มเติมต่อปี (นอกจากส่วนตัว/ประกันสังคม)
    ssoEnabled: boolean("sso_enabled").notNull().default(true),
    bankName: text("bank_name"),
    bankAccount: text("bank_account"),
    allowRemoteCheckin: boolean("allow_remote_checkin").notNull().default(false),
    // โปรไฟล์ — พนักงานแก้เองได้ที่ /account (HR แก้ได้ที่ /personnel/[id])
    lineId: text("line_id"),
    address: text("address"),
    emergencyName: text("emergency_name"),
    emergencyPhone: text("emergency_phone"),
    bio: text("bio"),
    // ที่อยู่แยกช่อง (ใช้ในสัญญาจ้าง/เอกสารราชการ) — ช่อง address เดิมยังใช้เป็นที่อยู่แบบบรรทัดเดียว
    addrNo: text("addr_no"),
    addrMoo: text("addr_moo"),
    addrVillage: text("addr_village"),
    addrSoi: text("addr_soi"),
    addrRoad: text("addr_road"),
    addrSubdistrict: text("addr_subdistrict"),
    addrDistrict: text("addr_district"),
    addrProvince: text("addr_province"),
    addrZip: text("addr_zip"),
    // ผู้อนุมัติแทน (หัวหน้าตั้งไว้ระหว่างลา) — มีผลถึงวันที่ actingUntil
    actingApproverId: integer("acting_approver_id").references((): AnyPgColumn => employees.id, { onDelete: "set null" }),
    actingUntil: date("acting_until"),
    createdAt: createdAt(),
  },
  (t) => [index("employees_branch_idx").on(t.branchId), index("employees_manager_idx").on(t.managerId)],
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("employee"),
  employeeId: integer("employee_id")
    .unique()
    .references(() => employees.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** รูปโปรไฟล์ (JPEG ย่อแล้ว ~400px, base64) แยกตารางเพื่อไม่ให้ select พนักงานทั่วไปลากรูปมาด้วย */
export const employeePhotos = pgTable("employee_photos", {
  employeeId: integer("employee_id")
    .primaryKey()
    .references(() => employees.id, { onDelete: "cascade" }),
  mime: text("mime").notNull().default("image/jpeg"),
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Passkey/ลายนิ้วมือบนมือถือ — เก็บแค่ public key, ไม่มีข้อมูลลายนิ้วมือขึ้นเซิร์ฟเวอร์ */
export const webauthnCredentials = pgTable(
  "webauthn_credentials",
  {
    id: text("id").primaryKey(), // credential ID (base64url)
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(), // base64url
    counter: integer("counter").notNull().default(0),
    transports: text("transports").array(),
    deviceName: text("device_name"),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("webauthn_user_idx").on(t.userId)],
);

/* ----------------------------- Time Attendance ---------------------------- */
export const attendanceLogs = pgTable(
  "attendance_logs",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    type: punchTypeEnum("type").notNull(),
    punchedAt: timestamp("punched_at", { withTimezone: true }).notNull(),
    method: punchMethodEnum("method").notNull().default("biometric"),
    branchId: integer("branch_id").references(() => branches.id, { onDelete: "set null" }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    accuracyM: doublePrecision("accuracy_m"),
    distanceM: doublePrecision("distance_m"),
    credentialId: text("credential_id"),
    userAgent: text("user_agent"),
    ip: text("ip"),
    note: text("note"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("attendance_emp_time_idx").on(t.employeeId, t.punchedAt)],
);

/* ------------------------------ Approve Center ---------------------------- */
export const requests = pgTable(
  "requests",
  {
    id: serial("id").primaryKey(),
    type: requestTypeEnum("type").notNull(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    status: requestStatusEnum("status").notNull().default("pending"),
    // leave
    leaveTypeId: integer("leave_type_id").references(() => leaveTypes.id),
    startDate: date("start_date"),
    endDate: date("end_date"),
    days: numeric("days", { precision: 5, scale: 1 }),
    // ot
    otDate: date("ot_date"),
    otHours: numeric("ot_hours", { precision: 5, scale: 2 }),
    otRate: numeric("ot_rate", { precision: 3, scale: 1 }),
    // time correction
    correctionAt: timestamp("correction_at", { withTimezone: true }),
    correctionType: punchTypeEnum("correction_type"),
    reason: text("reason"),
    // ขั้นที่ 1: หัวหน้าแผนกอนุมัติ (ลา/แก้เวลา ยัง pending รอ HR ต่อ)
    headApprovedBy: integer("head_approved_by").references(() => users.id, { onDelete: "set null" }),
    headApprovedAt: timestamp("head_approved_at", { withTimezone: true }),
    headNote: text("head_note"),
    // ผลสุดท้าย
    decidedBy: integer("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: createdAt(),
  },
  (t) => [index("requests_emp_idx").on(t.employeeId), index("requests_status_idx").on(t.status)],
);

/* --------------------------------- Payroll -------------------------------- */
export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    status: payrollStatusEnum("status").notNull().default("draft"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("payroll_period_uq").on(t.year, t.month)],
);

export const payrollItems = pgTable(
  "payroll_items",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    payType: payTypeEnum("pay_type").notNull(),
    baseSalary: money("base_salary"),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    workedDays: integer("worked_days").notNull().default(0),
    paidLeaveDays: numeric("paid_leave_days", { precision: 5, scale: 1 }).notNull().default("0"),
    unpaidLeaveDays: numeric("unpaid_leave_days", { precision: 5, scale: 1 }).notNull().default("0"),
    absentDays: integer("absent_days").notNull().default(0),
    lateMinutes: integer("late_minutes").notNull().default(0),
    otHours: numeric("ot_hours", { precision: 6, scale: 2 }).notNull().default("0"),
    earnedSalary: money("earned_salary"),
    otAmount: money("ot_amount"),
    allowance: money("allowance"),
    otherIncome: money("other_income"),
    lateDeduction: money("late_deduction"),
    sso: money("sso"),
    tax: money("tax"),
    otherDeduction: money("other_deduction"),
    gross: money("gross"),
    net: money("net"),
  },
  (t) => [uniqueIndex("payroll_item_uq").on(t.runId, t.employeeId)],
);

/* ---------------------------------- Audit --------------------------------- */
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  detail: jsonb("detail"),
  createdAt: createdAt(),
});

/* ------------------------------ แจ้งเตือน -------------------------------- */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // payslip | request_new | request_decided | warning | system
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

/** การสมัครรับแจ้งเตือนเด้ง (Web Push) — 1 แถวต่อ 1 เบราว์เซอร์/มือถือ */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
});

/* ------------------------------- ใบเตือน -------------------------------- */
export const warningLevelEnum = pgEnum("warning_level", ["verbal", "written", "final"]);

export const warnings = pgTable(
  "warnings",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    level: warningLevelEnum("level").notNull(),
    category: text("category").notNull(), // มาสาย / ขาดงาน / ระเบียบ / พฤติกรรม / การปฏิบัติงาน / อื่น ๆ
    incidentDate: date("incident_date").notNull(),
    reason: text("reason").notNull(), // เหตุผล/รายละเอียดที่ HR กรอก
    action: text("action"), // สิ่งที่ต้องปรับปรุง / มาตรการ
    issuedBy: integer("issued_by").references(() => users.id, { onDelete: "set null" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }), // พนักงานกดรับทราบ
    employeeNote: text("employee_note"), // คำชี้แจงของพนักงาน
    voidedAt: timestamp("voided_at", { withTimezone: true }), // ยกเลิกใบเตือน
    voidReason: text("void_reason"),
    validUntil: date("valid_until"), // วันหมดผล (คำนวณตอนออกตามการตั้งค่าขณะนั้น) — null = 1 ปีนับจากวันเกิดเหตุ
  },
  (t) => [index("warnings_employee_idx").on(t.employeeId)],
);

/** ตั้งค่าแต่ละระดับการเตือน (HR แก้ได้ที่ ตั้งค่าองค์กร → ใบเตือน) */
export const warningLevelSettings = pgTable("warning_level_settings", {
  level: warningLevelEnum("level").primaryKey(),
  name: text("name").notNull(), // ชื่อที่แสดงในระบบ เช่น "หนังสือเตือน"
  docTitle: text("doc_title").notNull(), // หัวเรื่องในเอกสาร
  description: text("description"), // คำอธิบายในฟอร์มออกใบเตือน
  validityMonths: integer("validity_months").notNull().default(12), // มีผลกี่เดือน
  closingText: text("closing_text"), // ข้อความท้ายหนังสือ (ผลถ้าทำผิดซ้ำ)
  enabled: boolean("enabled").notNull().default(true),
});

/** ประเภทความผิด (HR เพิ่ม/แก้/ปิดได้) — ใบเตือนเก็บชื่อไว้เป็นข้อความ จึงไม่กระทบใบเก่า */
export const warningCategories = pgTable("warning_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** ยอดยกมาภาษีของปี (เงินได้/ภาษี/ประกันสังคม ก่อนเริ่มใช้ระบบ หรือจากนายจ้างเดิม) — ใช้หักภาษีแบบสะสม */
export const taxOpeningBalances = pgTable(
  "tax_opening_balances",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    income: money("income"),
    sso: money("sso"),
    tax: money("tax"),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tax_opening_uq").on(t.employeeId, t.year)],
);

/**
 * แม่แบบสัญญาจ้าง (ตามตำแหน่ง) — ข้อความหลักของสัญญาตายตัวในระบบ
 * HR แก้ได้เฉพาะส่วนที่ต่างกัน: เวลาทำงาน (ข้อ 9) วันหยุด (ข้อ 10) รายการค่าจ้าง (ข้อ 12) เงื่อนไขอื่น และข้อผูกพันเพิ่มเติม
 * ข้อความหลายบรรทัดเก็บแบบขึ้นบรรทัดใหม่ 1 บรรทัด = 1 ข้อย่อย
 */
export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // เช่น พยาบาล 12 ชม.
  docCode: text("doc_code"), // รหัสแบบฟอร์ม เช่น HR-2024-CT-033
  probationDays: integer("probation_days").notNull().default(119),
  workTerms: text("work_terms").notNull().default(""), // ข้อ 9 วันและเวลาทำงาน
  holidayTerms: text("holiday_terms").notNull().default(""), // ข้อ 10 วันหยุด
  payLabels: text("pay_labels").notNull().default("ค่าฐานเงินเดือน"), // ข้อ 12 ชื่อรายการค่าจ้าง
  payUnit: text("pay_unit").notNull().default("ต่อเดือน"), // ต่อเดือน / ต่อเวร / ต่อวัน
  conditions: text("conditions").notNull().default(""), // เงื่อนไขข้อตกลงอื่น ๆ (ค่าเริ่มต้น)
  extraClauseTitle: text("extra_clause_title"), // ข้อเพิ่มเติมท้ายสัญญา (ถ้ามี)
  extraClause: text("extra_clause"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** สัญญาจ้างที่ออกให้พนักงาน — เก็บข้อมูล ณ วันที่ทำสัญญาไว้ตายตัว (แก้ข้อมูลพนักงานภายหลังไม่กระทบสัญญาเดิม) */
export const employmentContracts = pgTable(
  "employment_contracts",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    templateId: integer("template_id").references(() => contractTemplates.id, { onDelete: "set null" }),
    contractDate: date("contract_date").notNull(),
    kind: text("kind").notNull().default("permanent"), // permanent = พนักงานประจำ (มีทดลองงาน) · temporary = พนักงานชั่วคราว
    probationDays: integer("probation_days").notNull().default(119),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"), // พนักงานชั่วคราว: วันสิ้นสุดการจ้าง
    position: text("position"),
    department: text("department"),
    probationPay: jsonb("probation_pay").$type<Array<{ label: string; amount: number }>>().notNull().default([]),
    regularPay: jsonb("regular_pay").$type<Array<{ label: string; amount: number }>>().notNull().default([]),
    probationConditions: text("probation_conditions"),
    regularConditions: text("regular_conditions"),
    terms: jsonb("terms").$type<{ name: string; docCode: string | null; workTerms: string; holidayTerms: string; payUnit: string; extraClauseTitle: string | null; extraClause: string | null }>().notNull(),
    party: jsonb("party").$type<Record<string, string | null>>().notNull(), // ข้อมูลลูกจ้าง ณ วันทำสัญญา
    signers: jsonb("signers").$type<{ employerRep: string | null; employerRepTitle: string | null; hrHead: string | null; witness: string | null }>().notNull(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("contracts_employee_idx").on(t.employeeId)],
);

/** ใบประกอบวิชาชีพ / ใบรับรอง / การอบรม — เตือนก่อนหมดอายุ */
export const employeeLicenses = pgTable(
  "employee_licenses",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // เช่น ใบอนุญาตประกอบวิชาชีพการพยาบาล, CPR / BLS
    licenseNo: text("license_no"),
    issuedAt: date("issued_at"),
    expiresAt: date("expires_at"), // null = ไม่มีวันหมดอายุ
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("licenses_employee_idx").on(t.employeeId), index("licenses_expires_idx").on(t.expiresAt)],
);

/** หนังสือรับรองการทำงาน / รับรองเงินเดือน — พนักงานขอ HR อนุมัติแล้วพิมพ์ได้ */
export const certificateKindEnum = pgEnum("certificate_kind", ["employment", "salary"]);
export const certificateRequests = pgTable(
  "certificate_requests",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    kind: certificateKindEnum("kind").notNull(),
    purpose: text("purpose").notNull(), // เช่น ยื่นขอสินเชื่อ ยื่นวีซ่า
    copies: integer("copies").notNull().default(1),
    status: requestStatusEnum("status").notNull().default("pending"),
    decidedBy: integer("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    docNo: text("doc_no"), // เลขที่หนังสือ (ออกตอนอนุมัติ)
    createdAt: createdAt(),
  },
  (t) => [index("cert_employee_idx").on(t.employeeId)],
);

/** ตารางเวรรายวัน: มีแถว = ใช้กะนี้วันนั้น (shiftId null = วันหยุด) · ไม่มีแถว = ใช้กะประจำของพนักงาน */
export const shiftAssignments = pgTable(
  "shift_assignments",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    shiftId: integer("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("shift_assign_uq").on(t.employeeId, t.date), index("shift_assign_date_idx").on(t.date)],
);

/** ขอแลกเวร: ผู้ขอ → เพื่อนตอบรับ → หัวหน้าอนุมัติ (จบที่หัวหน้า แล้วแจ้ง HR) */
export const swapStatusEnum = pgEnum("swap_status", ["pending_partner", "pending_head", "approved", "rejected", "cancelled"]);
export const shiftSwaps = pgTable(
  "shift_swaps",
  {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    requesterDate: date("requester_date").notNull(), // เวรของผู้ขอที่จะให้เพื่อนทำแทน
    partnerDate: date("partner_date").notNull(), // เวรของเพื่อนที่ผู้ขอจะทำแทน (วันเดียวกันได้ = สลับกะ)
    reason: text("reason"),
    status: swapStatusEnum("status").notNull().default("pending_partner"),
    partnerAt: timestamp("partner_at", { withTimezone: true }),
    decidedBy: integer("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: createdAt(),
  },
  (t) => [index("swap_requester_idx").on(t.requesterId), index("swap_partner_idx").on(t.partnerId)],
);

/* -------------------------------- Relations ------------------------------- */
export const employeesRelations = relations(employees, ({ one }) => ({
  branch: one(branches, { fields: [employees.branchId], references: [branches.id] }),
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  position: one(positions, { fields: [employees.positionId], references: [positions.id] }),
  shift: one(shifts, { fields: [employees.shiftId], references: [shifts.id] }),
  manager: one(employees, { fields: [employees.managerId], references: [employees.id] }),
}));

export type Employee = typeof employees.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
