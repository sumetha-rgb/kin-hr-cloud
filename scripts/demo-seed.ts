/**
 * ข้อมูลจำลองสำหรับทดลองระบบ: npm run db:demo
 * - ใช้ได้เฉพาะตอนยังไม่มีพนักงานในระบบ (กันทับข้อมูลจริง)
 * - ล้างทิ้งทั้งหมดด้วย: npm run db:reset -- --yes
 * รหัสผ่านของพนักงานจำลองทุกคน: Demo@1234
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";

const { db } = await import("../src/db/index.js");
const s = await import("../src/db/schema.js");
const { calculateRun } = await import("../src/lib/payroll-run.js");
const { addDays, atBkk, bkkDateStr, eachDate, isoWeekday } = await import("../src/lib/time.js");

const [{ n }] = await db.select({ n: count() }).from(s.employees);
if (n > 0) {
  console.error(`❌ มีพนักงานในระบบแล้ว ${n} คน — ไม่สร้างข้อมูลจำลองทับ (ล้างก่อนด้วย npm run db:reset -- --yes)`);
  process.exit(1);
}

/* ------------------------------ random (คงที่) ----------------------------- */
let seed = 20261118;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const hhmm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

function fakeNationalId() {
  const d = [between(1, 3), ...Array.from({ length: 11 }, () => between(0, 9))];
  const sum = d.reduce((a, v, i) => a + v * (13 - i), 0);
  return d.join("") + ((11 - (sum % 11)) % 10);
}

/* -------------------------------- องค์กร --------------------------------- */
// ข้อมูลนิติบุคคลจริงของ KIN (kin-knowledge) · พิกัดสาขาอื่นนอกจากลาดพร้าว 71 เป็นค่าประมาณ ให้ HR กด "ใช้ตำแหน่งปัจจุบัน" ที่สาขาเพื่อตั้งค่าจริง
await db
  .update(s.companySettings)
  .set({
    name: "บริษัท ทีทรี สโตรก เนอสซิ่งโฮม จำกัด (KIN Rehabilitation & Homecare)",
    taxId: "0105561155236",
    address: "เลขที่ 6 ซอยนาคนิวาส 18 (ลาดพร้าว 71) แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230",
  })
  .where(eq(s.companySettings.id, 1));

await db
  .update(s.branches)
  .set({ name: "KIN ลาดพร้าว 71 (สำนักงานใหญ่)", address: "6 ซ.นาคนิวาส 18 แขวงลาดพร้าว เขตลาดพร้าว กทม. 10230", latitude: 13.8073441, longitude: 100.6088947, radiusM: 200 })
  .where(eq(s.branches.code, "HQ"));
await db.insert(s.branches).values([
  { code: "S107", name: "KIN สุขุมวิท 107", address: "596 ซอยแบริ่ง 10 ต.สำโรงเหนือ อ.เมืองสมุทรปราการ (พิกัดประมาณ)", latitude: 13.662, longitude: 100.609, radiusM: 250 },
  { code: "RP", name: "KIN ราชพฤกษ์", address: "55/11-14 หมู่ 1 ถ.ราชพฤกษ์ ต.อ้อมเกร็ด อ.ปากเกร็ด นนทบุรี (พิกัดประมาณ)", latitude: 13.9085, longitude: 100.466, radiusM: 250 },
  { code: "PTY", name: "KIN พัทยา", address: "51/81-83 หมู่ 2 ต.หนองปรือ อ.บางละมุง ชลบุรี (พิกัดประมาณ)", latitude: 12.927, longitude: 100.896, radiusM: 250 },
]);
const branchRows = await db.select().from(s.branches);
const B = Object.fromEntries(branchRows.map((b) => [b.code, b]));

const deptNames = ["ผู้บริหาร", "ทรัพยากรบุคคล", "บัญชีและการเงิน", "KIN HomeCare", "การพยาบาล", "กายภาพบำบัด"];
const deptRows = await db.insert(s.departments).values(deptNames.map((name) => ({ name }))).returning();
const D = Object.fromEntries(deptRows.map((d) => [d.name, d.id]));

const posDefs: Array<[string, string]> = [
  ["ผู้จัดการทั่วไป", "ผู้บริหาร"],
  ["ผู้จัดการฝ่ายบุคคล", "ทรัพยากรบุคคล"],
  ["เจ้าหน้าที่บุคคล", "ทรัพยากรบุคคล"],
  ["ผู้จัดการฝ่ายบัญชี", "บัญชีและการเงิน"],
  ["นักบัญชี", "บัญชีและการเงิน"],
  ["ผู้ประสานงาน HomeCare", "KIN HomeCare"],
  ["นักบริบาลดูแลที่บ้าน", "KIN HomeCare"],
  ["หัวหน้าพยาบาล", "การพยาบาล"],
  ["พยาบาลวิชาชีพ", "การพยาบาล"],
  ["ผู้ช่วยพยาบาล", "การพยาบาล"],
  ["นักบริบาลรายวัน", "การพยาบาล"],
  ["หัวหน้านักกายภาพบำบัด", "กายภาพบำบัด"],
  ["นักกายภาพบำบัด", "กายภาพบำบัด"],
];
const posRows = await db
  .insert(s.positions)
  .values(posDefs.map(([name, dept]) => ({ name, departmentId: D[dept] })))
  .returning();
const P = Object.fromEntries(posRows.map((p) => [p.name, p.id]));

const shiftRows = await db.select().from(s.shifts);
const SH = {
  day: shiftRows.find((x) => x.startTime === "08:00")!,
  morning: shiftRows.find((x) => x.startTime === "07:00")!,
  night: shiftRows.find((x) => x.startTime === "19:00")!,
};

const year = 2026;
await db
  .insert(s.holidays)
  .values([
    [`${year}-01-01`, "วันขึ้นปีใหม่"],
    [`${year}-04-06`, "วันจักรี"],
    [`${year}-04-13`, "วันสงกรานต์"],
    [`${year}-04-14`, "วันสงกรานต์"],
    [`${year}-04-15`, "วันสงกรานต์"],
    [`${year}-05-01`, "วันแรงงานแห่งชาติ"],
    [`${year}-05-04`, "วันฉัตรมงคล"],
    [`${year}-06-03`, "วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี"],
    [`${year}-07-28`, "วันเฉลิมพระชนมพรรษา ร.10"],
    [`${year}-08-12`, "วันแม่แห่งชาติ"],
    [`${year}-10-13`, "วันนวมินทรมหาราช"],
    [`${year}-10-23`, "วันปิยมหาราช"],
    [`${year}-12-05`, "วันพ่อแห่งชาติ"],
    [`${year}-12-10`, "วันรัฐธรรมนูญ"],
    [`${year}-12-31`, "วันสิ้นปี"],
  ].map(([date, name]) => ({ date, name })))
  .onConflictDoNothing();
const holidaySet = new Set((await db.select().from(s.holidays)).map((h) => h.date));

/* -------------------------------- พนักงาน -------------------------------- */
type Def = {
  first: string;
  last: string;
  nick: string;
  prefix: string;
  pos: string;
  branch: string;
  salary: number;
  pay?: "monthly" | "daily";
  shift?: keyof typeof SH;
  role?: "hr" | "manager" | "employee";
  start?: string;
  status?: "probation" | "active" | "resigned";
  end?: string;
  allowance?: number;
  remote?: boolean;
  lateProne?: boolean;
};
const defs: Def[] = [
  { prefix: "นาย", first: "ธนากร", last: "วงศ์สวัสดิ์", nick: "กร", pos: "ผู้จัดการทั่วไป", branch: "HQ", salary: 150000, role: "manager", start: "2019-03-01", allowance: 10000 },
  { prefix: "นางสาว", first: "พิมพ์ชนก", last: "ศรีสุข", nick: "พิม", pos: "ผู้จัดการฝ่ายบุคคล", branch: "HQ", salary: 58000, role: "hr", start: "2020-06-01", allowance: 3000 },
  { prefix: "นางสาว", first: "กมลชนก", last: "แสงทอง", nick: "แพรว", pos: "เจ้าหน้าที่บุคคล", branch: "HQ", salary: 24000, role: "hr", start: "2023-02-15" },
  { prefix: "นาง", first: "สุภาพร", last: "เจริญผล", nick: "ภา", pos: "ผู้จัดการฝ่ายบัญชี", branch: "HQ", salary: 52000, role: "manager", start: "2020-01-06", allowance: 3000 },
  { prefix: "นางสาว", first: "ณัฐธิดา", last: "บุญมา", nick: "ฝน", pos: "นักบัญชี", branch: "HQ", salary: 27000, start: "2022-08-01" },
  { prefix: "นาย", first: "วรวุฒิ", last: "ทองดี", nick: "วุฒิ", pos: "นักบัญชี", branch: "HQ", salary: 23000, start: "2024-04-01", lateProne: true },
  { prefix: "นาย", first: "อนุชา", last: "พรหมมา", nick: "ชา", pos: "ผู้ประสานงาน HomeCare", branch: "HQ", salary: 60000, role: "manager", start: "2021-05-10", allowance: 5000, remote: true },
  { prefix: "นางสาว", first: "ศิริพร", last: "ใจดี", nick: "ปุ้ย", pos: "นักบริบาลดูแลที่บ้าน", branch: "HQ", salary: 22000, start: "2023-07-03", allowance: 2000, remote: true },
  { prefix: "นาย", first: "ปิยะพงษ์", last: "สมบูรณ์", nick: "ปิง", pos: "นักบริบาลดูแลที่บ้าน", branch: "S107", salary: 21000, start: "2024-01-08", allowance: 2000, remote: true, lateProne: true },
  { prefix: "นางสาว", first: "จิราพร", last: "มีสุข", nick: "จิ๊บ", pos: "นักบริบาลดูแลที่บ้าน", branch: "S107", salary: 20000, start: "2025-02-03", allowance: 2000, remote: true },
  { prefix: "นาย", first: "ธีรวัฒน์", last: "แก้วกาญจนา", nick: "ธีร์", pos: "นักบริบาลดูแลที่บ้าน", branch: "RP", salary: 20500, start: "2024-09-02", allowance: 2000, remote: true },
  { prefix: "นางสาว", first: "อรวรรณ", last: "ศักดิ์ดี", nick: "อร", pos: "นักบริบาลดูแลที่บ้าน", branch: "PTY", salary: 19500, start: "2026-09-01", status: "probation", allowance: 1500, remote: true },
  { prefix: "นาย", first: "สมชาย", last: "รักษ์ไทย", nick: "ชาย", pos: "หัวหน้าพยาบาล", branch: "S107", salary: 38000, role: "manager", start: "2018-11-01", allowance: 2500 },
  { prefix: "นาย", first: "ประเสริฐ", last: "นาคสุข", nick: "เสริฐ", pos: "พยาบาลวิชาชีพ", branch: "S107", salary: 16500, shift: "morning", start: "2022-03-01" },
  { prefix: "นาง", first: "บุญเรือน", last: "ศรีอ่อน", nick: "เรือน", pos: "ผู้ช่วยพยาบาล", branch: "S107", salary: 16000, shift: "morning", start: "2021-10-01" },
  { prefix: "นาย", first: "สุรเชษฐ์", last: "ดวงแก้ว", nick: "เชษฐ์", pos: "ผู้ช่วยพยาบาล", branch: "S107", salary: 17000, shift: "night", start: "2022-12-01", lateProne: true },
  { prefix: "นางสาว", first: "วิไลวรรณ", last: "พุ่มพวง", nick: "วิ", pos: "พยาบาลวิชาชีพ", branch: "S107", salary: 16500, shift: "night", start: "2023-05-15" },
  { prefix: "นาย", first: "กิตติศักดิ์", last: "มั่นคง", nick: "กิต", pos: "ผู้ช่วยพยาบาล", branch: "RP", salary: 16000, start: "2024-06-03" },
  { prefix: "นางสาว", first: "รัตนา", last: "ทองคำ", nick: "นา", pos: "ผู้ช่วยพยาบาล", branch: "RP", salary: 15500, start: "2025-01-06" },
  { prefix: "นาย", first: "ชัยวัฒน์", last: "อินทร์แก้ว", nick: "ชัย", pos: "พยาบาลวิชาชีพ", branch: "RP", salary: 16000, shift: "morning", start: "2023-09-01" },
  { prefix: "นาง", first: "สมศรี", last: "บัวแก้ว", nick: "ศรี", pos: "ผู้ช่วยพยาบาล", branch: "PTY", salary: 15500, start: "2020-02-03" },
  { prefix: "นาย", first: "อภิชาติ", last: "ชูศรี", nick: "ชาติ", pos: "ผู้ช่วยพยาบาล", branch: "PTY", salary: 15500, start: "2026-08-17", status: "probation" },
  { prefix: "นาย", first: "บุญมี", last: "สายทอง", nick: "มี", pos: "นักบริบาลรายวัน", branch: "S107", salary: 420, pay: "daily", start: "2024-11-01", lateProne: true },
  { prefix: "นาย", first: "สมปอง", last: "ใจกล้า", nick: "ปอง", pos: "นักบริบาลรายวัน", branch: "S107", salary: 400, pay: "daily", start: "2025-03-01" },
  { prefix: "นางสาว", first: "มาลัย", last: "ดอกไม้", nick: "มาลัย", pos: "นักบริบาลรายวัน", branch: "RP", salary: 400, pay: "daily", start: "2025-06-02" },
  { prefix: "นาย", first: "จักรพันธ์", last: "เพชรรัตน์", nick: "จักร", pos: "นักบริบาลรายวัน", branch: "PTY", salary: 410, pay: "daily", start: "2024-08-01" },
  { prefix: "นาย", first: "ภาณุวัฒน์", last: "ศรีวิไล", nick: "ภาณุ", pos: "หัวหน้านักกายภาพบำบัด", branch: "HQ", salary: 65000, role: "manager", start: "2021-01-11", allowance: 3000 },
  { prefix: "นาย", first: "ณัฐพล", last: "จันทร์เพ็ญ", nick: "ณัฐ", pos: "นักกายภาพบำบัด", branch: "HQ", salary: 42000, start: "2022-10-03" },
  { prefix: "นางสาว", first: "ปวีณา", last: "รุ่งเรือง", nick: "ปวี", pos: "นักกายภาพบำบัด", branch: "HQ", salary: 38000, start: "2023-11-01" },
  { prefix: "นาย", first: "เอกชัย", last: "พงษ์ไพบูลย์", nick: "เอก", pos: "นักกายภาพบำบัด", branch: "HQ", salary: 35000, start: "2025-04-01", lateProne: true },
  { prefix: "นาย", first: "วีระ", last: "กล้าหาญ", nick: "วี", pos: "ผู้ช่วยพยาบาล", branch: "PTY", salary: 15500, start: "2023-01-09", status: "resigned", end: "2026-10-15" },
  { prefix: "นางสาว", first: "ชลธิชา", last: "นิลสุวรรณ", nick: "ชล", pos: "นักบัญชี", branch: "HQ", salary: 21000, start: "2026-11-02", status: "probation" },
];
const banks = ["กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย", "กรุงศรีอยุธยา"];
const deptOfPos = Object.fromEntries(posDefs.map(([p, d]) => [p, d]));

const empRows = await db
  .insert(s.employees)
  .values(
    defs.map((d, i) => ({
      code: `E${String(i + 1).padStart(4, "0")}`,
      prefix: d.prefix,
      firstName: d.first,
      lastName: d.last,
      nickname: d.nick,
      nationalId: fakeNationalId(),
      phone: `08${between(1, 9)}${String(between(0, 9999999)).padStart(7, "0")}`,
      email: `e${String(i + 1).padStart(4, "0")}@demo.kinrehab.local`,
      birthDate: `${between(1975, 2002)}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`,
      startDate: d.start ?? "2024-01-01",
      endDate: d.end ?? null,
      status: d.status ?? "active",
      branchId: B[d.branch].id,
      departmentId: D[deptOfPos[d.pos]],
      positionId: P[d.pos],
      shiftId: SH[d.shift ?? "day"].id,
      payType: d.pay ?? "monthly",
      baseSalary: d.salary.toFixed(2),
      monthlyAllowance: (d.allowance ?? 0).toFixed(2),
      bankName: pick(banks),
      bankAccount: String(between(100, 999)) + String(between(1000000, 9999999)),
      allowRemoteCheckin: d.remote ?? false,
    })),
  )
  .returning();
const byCode = new Map(empRows.map((e) => [e.code, e]));
const emp = (i: number) => byCode.get(`E${String(i + 1).padStart(4, "0")}`)!;

// หัวหน้างาน: หัวหน้าแผนก → กรรมการผู้จัดการ, ลูกทีม → หัวหน้าแผนก
const ceo = emp(0);
const headOf: Record<string, number> = {};
defs.forEach((d, i) => {
  if (d.role === "manager" || (d.role === "hr" && d.pos.startsWith("ผู้จัดการ"))) headOf[deptOfPos[d.pos]] = emp(i).id;
});
for (let i = 1; i < defs.length; i++) {
  const d = defs[i];
  const head = headOf[deptOfPos[d.pos]];
  const managerId = head === emp(i).id ? ceo.id : (head ?? ceo.id);
  await db.update(s.employees).set({ managerId }).where(eq(s.employees.id, emp(i).id));
}

// บัญชีผู้ใช้
const hash = await bcrypt.hash("Demo@1234", 12);
const userRows = await db
  .insert(s.users)
  .values(defs.map((d, i) => ({ username: emp(i).code.toLowerCase(), passwordHash: hash, role: d.role ?? "employee", employeeId: emp(i).id, active: d.status !== "resigned" })))
  .returning();
const userOf = new Map(userRows.map((u) => [u.employeeId!, u.id]));
const hrUser = userOf.get(emp(1).id)!;

/* ---------------------------- ใบลา / OT / แก้เวลา --------------------------- */
const lt = Object.fromEntries((await db.select().from(s.leaveTypes)).map((l) => [l.code, l.id]));
type Req = typeof s.requests.$inferInsert;
const reqs: Req[] = [];
const leaveDays = new Map<number, Set<string>>(); // employeeId → วันที่ลา (อนุมัติแล้ว) ไม่ต้องสร้างการสแกน
const addLeave = (i: number, code: string, start: string, end: string, days: number, status: Req["status"], reason: string) => {
  const e = emp(i);
  const decided = status === "approved" || status === "rejected";
  reqs.push({
    type: "leave",
    employeeId: e.id,
    status,
    leaveTypeId: lt[code],
    startDate: start,
    endDate: end,
    days: String(days),
    reason,
    decidedBy: decided ? (e.managerId ? (userOf.get(e.managerId) ?? hrUser) : hrUser) : null,
    decidedAt: decided ? atBkk(addDays(start, -2), "10:15") : null,
    decisionNote: status === "rejected" ? "ช่วงนี้งานเร่ง ขอเลื่อนไปเดือนหน้า" : null,
    createdAt: atBkk(addDays(start, -4), "09:30"),
  });
  if (status === "approved" && days >= 1) {
    const set = leaveDays.get(e.id) ?? new Set();
    eachDate(start, end).forEach((d) => set.add(d));
    leaveDays.set(e.id, set);
  }
};
addLeave(4, "SL", "2026-09-14", "2026-09-15", 2, "approved", "ไข้หวัดใหญ่ มีใบรับรองแพทย์");
addLeave(8, "PL", "2026-09-25", "2026-09-25", 1, "approved", "ติดต่อราชการ");
addLeave(13, "VL", "2026-10-05", "2026-10-07", 3, "approved", "พาครอบครัวไปเที่ยวต่างจังหวัด");
addLeave(17, "SL", "2026-10-19", "2026-10-19", 1, "approved", "ปวดท้อง");
addLeave(28, "VL", "2026-10-26", "2026-10-30", 5, "approved", "ลาพักร้อนประจำปี");
addLeave(5, "PL", "2026-11-04", "2026-11-04", 0.5, "approved", "พาลูกไปหาหมอช่วงเช้า");
addLeave(20, "SL", "2026-11-10", "2026-11-11", 2, "approved", "ผ่าตัดเล็ก");
addLeave(9, "VL", "2026-11-16", "2026-11-16", 1, "rejected", "ธุระส่วนตัว");
addLeave(7, "VL", "2026-11-25", "2026-11-27", 3, "pending", "กลับบ้านต่างจังหวัด");
addLeave(18, "PL", "2026-11-20", "2026-11-20", 1, "pending", "ย้ายบ้าน");
addLeave(29, "SL", "2026-11-17", "2026-11-17", 1, "pending", "เป็นไข้ ส่งใบรับรองแพทย์ย้อนหลัง");
addLeave(25, "UL", "2026-10-12", "2026-10-12", 1, "approved", "ธุระที่ต่างจังหวัด");

const otPlan: Array<[number, string, number, string, Req["status"]]> = [
  [13, "2026-09-18", 3, "1.5", "approved"],
  [14, "2026-09-18", 3, "1.5", "approved"],
  [22, "2026-09-26", 8, "2.0", "approved"],
  [15, "2026-10-09", 2, "1.5", "approved"],
  [16, "2026-10-09", 2, "1.5", "approved"],
  [12, "2026-10-17", 6, "1.0", "approved"],
  [23, "2026-10-17", 8, "2.0", "approved"],
  [27, "2026-10-21", 4, "1.5", "approved"],
  [28, "2026-11-06", 3, "1.5", "approved"],
  [13, "2026-11-13", 2, "1.5", "approved"],
  [19, "2026-11-14", 8, "1.0", "pending"],
  [22, "2026-11-15", 4, "3.0", "pending"],
  [29, "2026-11-17", 3, "1.5", "pending"],
];
for (const [i, date, hours, rate, status] of otPlan) {
  const e = emp(i);
  reqs.push({
    type: "ot",
    employeeId: e.id,
    status,
    otDate: date,
    otHours: hours.toFixed(2),
    otRate: rate,
    reason: pick(["ดูแลผู้พักกะเสริม", "รับผู้พักใหม่ช่วงเย็น", "เยี่ยมบ้านเคสด่วน", "อบรมทีมดูแล", "ทำงานแทนเพื่อนที่ลา"]),
    decidedBy: status === "approved" ? (e.managerId ? userOf.get(e.managerId) : hrUser) : null,
    decidedAt: status === "approved" ? atBkk(addDays(date, 1), "09:00") : null,
    createdAt: atBkk(date, "16:00"),
  });
}

// ลืมสแกน → ขอแก้เวลา
const forgot = new Map<string, "in" | "out">(); // `${empId}|${date}` → ไม่สร้าง punch ประเภทนั้น
const corrections: Array<[number, string, "in" | "out", string, Req["status"]]> = [
  [10, "2026-10-14", "out", "17:35", "approved"],
  [17, "2026-11-12", "in", "07:58", "pending"],
  [6, "2026-11-13", "out", "18:10", "pending"],
];
for (const [i, date, type, time, status] of corrections) {
  const e = emp(i);
  forgot.set(`${e.id}|${date}`, type);
  reqs.push({
    type: "time_correction",
    employeeId: e.id,
    status,
    correctionAt: atBkk(date, time),
    correctionType: type,
    reason: type === "in" ? "ลืมสแกนนิ้วตอนเข้างาน มือถือแบตหมด" : "ลืมสแกนออก รีบกลับบ้าน",
    decidedBy: status === "approved" ? hrUser : null,
    decidedAt: status === "approved" ? atBkk(addDays(date, 1), "11:00") : null,
    createdAt: atBkk(addDays(date, 1), "08:40"),
  });
}
await db.insert(s.requests).values(reqs);

/* -------------------------------- ลงเวลา -------------------------------- */
const now = new Date();
const today = bkkDateStr(now);
const from = "2026-09-01";
const logs: Array<typeof s.attendanceLogs.$inferInsert> = [];
const jitter = () => (rand() - 0.5) * 0.0012; // ~ ±60 ม.

defs.forEach((d, i) => {
  const e = emp(i);
  const shift = SH[d.shift ?? "day"];
  const workDays = shift.workDays.split(",").map(Number);
  const [sh, sm] = shift.startTime.split(":").map(Number);
  const [eh, em] = shift.endTime.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em + (shift.endTime <= shift.startTime ? 1440 : 0);
  const home = B[d.branch];
  const lastDay = e.endDate && e.endDate < today ? e.endDate : today;
  const firstDay = e.startDate > from ? e.startDate : from;
  if (firstDay > lastDay) return;

  for (const date of eachDate(firstDay, lastDay)) {
    // พนักงานกะ 7 วันได้หยุด 1 วันต่อสัปดาห์ตามรอบ
    if (!workDays.includes(isoWeekday(date))) continue;
    if (workDays.length === 7 && (isoWeekday(date) + i) % 7 === 0) continue;
    if (holidaySet.has(date) || leaveDays.get(e.id)?.has(date)) continue;
    const roll = rand();
    if (roll < 0.025) continue; // ขาดงาน
    const lateChance = d.lateProne ? 0.3 : 0.07;
    const inMin = rand() < lateChance ? startMin + between(6, 45) : startMin - between(3, 35);
    const outMin = endMin + between(0, 50);
    const missOut = rand() < 0.02;
    const atField = d.remote && rand() < 0.35;
    const lat = (atField ? home.latitude! + (rand() - 0.5) * 0.08 : home.latitude! + jitter());
    const lng = (atField ? home.longitude! + (rand() - 0.5) * 0.08 : home.longitude! + jitter());
    const dist = Math.round(atField ? between(900, 6000) : between(5, 90));
    const base = {
      employeeId: e.id,
      method: "biometric" as const,
      branchId: atField ? null : home.id,
      latitude: lat,
      longitude: lng,
      accuracyM: between(8, 45),
      distanceM: dist,
      credentialId: `demo-${e.code}`,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Demo",
      note: atField ? "ลงเวลานอกสถานที่" : null,
    };
    const inAt = atBkk(date, "00:00");
    inAt.setUTCMinutes(inAt.getUTCMinutes() + inMin);
    const outAt = atBkk(date, "00:00");
    outAt.setUTCMinutes(outAt.getUTCMinutes() + outMin);
    const skip = forgot.get(`${e.id}|${date}`);
    if (inAt < now && skip !== "in") logs.push({ ...base, type: "in", punchedAt: inAt, createdAt: inAt });
    if (outAt < now && !missOut && skip !== "out") logs.push({ ...base, type: "out", punchedAt: outAt, createdAt: outAt });
  }
});
// คำขอแก้เวลาที่อนุมัติแล้ว → มี log แบบ correction
for (const r of reqs.filter((r) => r.type === "time_correction" && r.status === "approved")) {
  logs.push({ employeeId: r.employeeId, type: r.correctionType!, punchedAt: r.correctionAt!, method: "correction", note: "อนุมัติคำขอแก้ไขเวลา", createdBy: hrUser });
}
for (let i = 0; i < logs.length; i += 500) await db.insert(s.attendanceLogs).values(logs.slice(i, i + 500));

/* -------------------------------- เงินเดือน -------------------------------- */
for (const [m, status] of [
  [9, "finalized"],
  [10, "finalized"],
  [11, "draft"],
] as const) {
  const [run] = await db.insert(s.payrollRuns).values({ year: 2026, month: m, createdBy: hrUser }).returning();
  await calculateRun(run.id);
  if (status === "finalized") await db.update(s.payrollRuns).set({ status, finalizedAt: atBkk(`2026-${String(m).padStart(2, "0")}-28`, "15:00") }).where(eq(s.payrollRuns.id, run.id));
}

console.log(`✅ สร้างข้อมูลจำลองแล้ว: พนักงาน ${empRows.length} คน, สาขา ${branchRows.length}, การลงเวลา ${logs.length} รายการ, คำขอ ${reqs.length} รายการ, งวดเงินเดือน 3 งวด`);
console.log("   เข้าระบบพนักงานจำลอง: username = รหัสพนักงาน (เช่น e0002 = HR, e0013 = หัวหน้างาน, e0014 = พนักงาน) / password = Demo@1234");
