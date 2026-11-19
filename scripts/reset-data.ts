/**
 * ล้างข้อมูลทั้งหมดกลับเป็นระบบว่าง (เหลือ admin, ตั้งค่าบริษัท, กะงาน, ประเภทการลา, สาขา HQ)
 * npm run db:reset -- --yes
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { ne } from "drizzle-orm";

if (!process.argv.includes("--yes")) {
  console.error("⚠️  คำสั่งนี้ลบพนักงาน การลงเวลา คำขอ และเงินเดือนทั้งหมด — ยืนยันด้วย: npm run db:reset -- --yes");
  process.exit(1);
}
const { db } = await import("../src/db/index.js");
const s = await import("../src/db/schema.js");

await db.delete(s.payrollRuns);
await db.delete(s.requests);
await db.delete(s.attendanceLogs);
await db.delete(s.users).where(ne(s.users.role, "admin"));
await db.update(s.users).set({ employeeId: null });
await db.delete(s.employees);
await db.delete(s.positions);
await db.delete(s.departments);
await db.delete(s.holidays);
await db.delete(s.branches).where(ne(s.branches.code, "HQ"));
await db.update(s.branches).set({ name: "สำนักงานใหญ่", address: null, latitude: null, longitude: null, radiusM: 150 });
await db.update(s.companySettings).set({ name: "บริษัทของฉัน", taxId: null, address: null });
await db.delete(s.auditLogs);
console.log("✅ ล้างข้อมูลแล้ว");
