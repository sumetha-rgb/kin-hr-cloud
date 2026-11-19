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
