/**
 * ข้อมูลตั้งต้น (รันซ้ำได้ ไม่ทับของเดิม): npm run db:seed
 * กำหนดรหัสผ่าน admin เองได้ด้วย SEED_ADMIN_PASSWORD=xxxx npm run db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const { db } = await import("../src/db/index.js");
const s = await import("../src/db/schema.js");

await db
  .insert(s.companySettings)
  .values({ id: 1, name: "บริษัทของฉัน", ssoRate: "5.00", ssoMinBase: "1650.00", ssoMaxBase: "15000.00" })
  .onConflictDoNothing();

await db
  .insert(s.leaveTypes)
  .values([
    { code: "SICK", name: "ลาป่วย", paid: true, daysPerYear: 30 },
    { code: "BUSINESS", name: "ลากิจ", paid: true, daysPerYear: 3 },
    { code: "VACATION", name: "ลาพักร้อน", paid: true, daysPerYear: 6 },
    { code: "MATERNITY", name: "ลาคลอด", paid: true, daysPerYear: 120 },
    { code: "UNPAID", name: "ลาไม่รับค่าจ้าง", paid: false, daysPerYear: 0 },
  ])
  .onConflictDoNothing();

const existingShift = await db.select().from(s.shifts).limit(1);
if (!existingShift.length) {
  await db.insert(s.shifts).values([
    { name: "กะปกติ 08:00-17:00 (จ-ศ)", startTime: "08:00", endTime: "17:00", breakMinutes: 60, lateGraceMinutes: 5, workDays: "1,2,3,4,5" },
    { name: "กะเช้า 07:00-19:00", startTime: "07:00", endTime: "19:00", breakMinutes: 60, lateGraceMinutes: 5, workDays: "1,2,3,4,5,6,7" },
    { name: "กะดึก 19:00-07:00", startTime: "19:00", endTime: "07:00", breakMinutes: 60, lateGraceMinutes: 5, workDays: "1,2,3,4,5,6,7" },
  ]);
}

await db.insert(s.branches).values({ code: "HQ", name: "สำนักงานใหญ่", radiusM: 150 }).onConflictDoNothing();

const admins = await db.select().from(s.users).where(eq(s.users.role, "admin")).limit(1);
if (!admins.length) {
  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  await db.insert(s.users).values({ username: "admin", passwordHash: await bcrypt.hash(password, 12), role: "admin" });
  console.log("\n✅ สร้างผู้ดูแลระบบแล้ว");
  console.log("   username: admin");
  console.log(`   password: ${password}`);
  console.log("   (เข้าสู่ระบบแล้วเปลี่ยนรหัสผ่านที่เมนู 'บัญชีของฉัน')\n");
} else {
  console.log("มีผู้ดูแลระบบอยู่แล้ว — ข้ามการสร้าง admin");
}
console.log("Seed เสร็จ");
