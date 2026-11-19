/**
 * คัดลอกข้อมูลทั้งหมดจากฐานข้อมูลเดิม (DATABASE_URL) ไปฐานข้อมูลใหม่ (NEW_DATABASE_URL)
 * ใช้ตอนย้าย Region ของ Neon — ฐานข้อมูลปลายทางต้องสร้างตารางแล้ว (drizzle-kit migrate) และยังว่าง
 *   npx tsx scripts/copy-db.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { neon } from "@neondatabase/serverless";
import { count, eq, getTableName, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgTable } from "drizzle-orm/pg-core";
import * as s from "../src/db/schema.js";

const SRC = process.env.DATABASE_URL;
const DST = process.env.NEW_DATABASE_URL;
if (!SRC || !DST) throw new Error("ต้องมีทั้ง DATABASE_URL (ต้นทาง) และ NEW_DATABASE_URL (ปลายทาง) ใน .env.local");
if (new URL(SRC).hostname === new URL(DST).hostname) throw new Error("ต้นทางกับปลายทางเป็นฐานข้อมูลเดียวกัน");

const src = drizzle(neon(SRC), { schema: s });
const dst = drizzle(neon(DST), { schema: s });
console.log(`ต้นทาง  ${new URL(SRC).hostname}\nปลายทาง ${new URL(DST).hostname}\n`);

// เรียงตามลำดับ foreign key (แม่ก่อนลูก)
const tables: PgTable[] = [
  s.companySettings,
  s.branches,
  s.departments,
  s.positions,
  s.shifts,
  s.holidays,
  s.leaveTypes,
  s.employees,
  s.users,
  s.webauthnCredentials,
  s.attendanceLogs,
  s.requests,
  s.payrollRuns,
  s.payrollItems,
  s.auditLogs,
];

// ปลายทางต้องว่าง กันการทับข้อมูล
for (const t of tables) {
  const [{ n }] = await dst.select({ n: count() }).from(t);
  if (n > 0 && t !== s.companySettings) throw new Error(`ปลายทางมีข้อมูลในตาราง ${getTableName(t)} แล้ว ${n} แถว — หยุดเพื่อไม่ให้ทับ`);
}
await dst.delete(s.companySettings);

// คอลัมน์ที่อ้างถึงตารางเดียวกัน ใส่ค่าว่างก่อน แล้วเติมทีหลัง
const selfRefs = new Map<PgTable, string>([
  [s.departments, "parentId"],
  [s.employees, "managerId"],
]);

for (const t of tables) {
  const rows = (await src.select().from(t)) as Record<string, unknown>[];
  const ref = selfRefs.get(t);
  const toInsert = ref ? rows.map((r) => ({ ...r, [ref]: null })) : rows;
  for (let i = 0; i < toInsert.length; i += 300) {
    await dst.insert(t).values(toInsert.slice(i, i + 300) as never);
  }
  if (ref) {
    const idCol = (t as unknown as Record<string, Parameters<typeof eq>[0]>).id;
    for (const r of rows.filter((r) => r[ref] != null)) {
      await dst.update(t).set({ [ref]: r[ref] } as never).where(eq(idCol, r.id as number));
    }
  }
  const [{ n }] = await dst.select({ n: count() }).from(t);
  const ok = n === rows.length;
  console.log(`${ok ? "✅" : "❌"} ${getTableName(t).padEnd(22)} ${rows.length} → ${n}`);
  if (!ok) throw new Error(`จำนวนแถวไม่ตรง: ${getTableName(t)}`);
}

// ตั้งตัวนับ id ให้ต่อจากค่าสูงสุด ไม่งั้นการเพิ่มข้อมูลใหม่จะชน id เดิม
for (const t of tables) {
  const name = getTableName(t);
  if (name === "company_settings" || name === "webauthn_credentials") continue;
  await dst.execute(sql.raw(`select setval(pg_get_serial_sequence('"${name}"','id'), coalesce((select max(id) from "${name}"), 0) + 1, false)`));
}
console.log("\n✅ คัดลอกครบทุกตาราง และตั้งตัวนับ id แล้ว");
