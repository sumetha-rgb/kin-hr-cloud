"use server";

import { and, eq, max, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { warningCategories, warningLevelSettings } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { withMsg } from "@/lib/util";
import { WARNING_LEVELS } from "@/lib/warning";
import { getWarningConfig } from "@/lib/warning-config";

const P = "/organization/warnings";
const fail = (error: string): never => redirect(withMsg(P, { error }));
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** บันทึกการตั้งค่าทั้ง 3 ระดับ */
export async function saveWarningLevels(fd: FormData) {
  const u = await requireRole("admin", "hr");
  await getWarningConfig(); // ให้มีแถวครบก่อน
  const rows = WARNING_LEVELS.map((level, i) => {
    const name = str(fd, `${level}.name`);
    const docTitle = str(fd, `${level}.docTitle`);
    const months = Number(str(fd, `${level}.validityMonths`));
    if (!name || !docTitle) fail(`ระดับ ${i + 1}: กรอกชื่อระดับและหัวเรื่องเอกสาร`);
    if (!Number.isInteger(months) || months < 1 || months > 12) fail(`ระดับ ${i + 1}: ระยะเวลามีผลต้องอยู่ระหว่าง 1-12 เดือน (กฎหมายกำหนดไม่เกิน 1 ปี)`);
    return {
      level,
      name: name.slice(0, 60),
      docTitle: docTitle.slice(0, 80),
      description: str(fd, `${level}.description`).slice(0, 200) || null,
      validityMonths: months,
      closingText: str(fd, `${level}.closingText`).slice(0, 1000) || null,
      enabled: fd.get(`${level}.enabled`) === "on",
    };
  });
  if (!rows.some((r) => r.enabled)) fail("ต้องเปิดใช้งานอย่างน้อย 1 ระดับ");
  for (const r of rows) {
    const { level, ...set } = r;
    await db.update(warningLevelSettings).set(set).where(eq(warningLevelSettings.level, level));
  }
  await audit(u.id, "update", "warning_settings", "levels", Object.fromEntries(rows.map((r) => [r.level, { name: r.name, months: r.validityMonths, enabled: r.enabled }])));
  redirect(withMsg(P, { ok: "บันทึกการตั้งค่าระดับการเตือนแล้ว — มีผลกับใบเตือนที่ออกหลังจากนี้" }));
}

export async function addWarningCategory(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const name = str(fd, "name").slice(0, 80);
  if (name.length < 2) fail("กรอกชื่อประเภทความผิด");
  const [dup] = await db.select({ id: warningCategories.id }).from(warningCategories).where(eq(warningCategories.name, name));
  if (dup) fail("มีประเภทนี้อยู่แล้ว");
  const [{ m }] = await db.select({ m: max(warningCategories.sortOrder) }).from(warningCategories);
  const [row] = await db.insert(warningCategories).values({ name, sortOrder: (m ?? 0) + 1 }).returning({ id: warningCategories.id });
  await audit(u.id, "create", "warning_category", row.id, { name });
  redirect(withMsg(P, { ok: `เพิ่มประเภท “${name}” แล้ว` }));
}

/** แก้ชื่อ — ใบเตือนเก่ายังแสดงชื่อเดิมตามที่ออกไป */
export async function renameWarningCategory(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id"));
  const name = str(fd, "name").slice(0, 80);
  if (name.length < 2) fail("กรอกชื่อประเภทความผิด");
  const [dup] = await db
    .select({ id: warningCategories.id })
    .from(warningCategories)
    .where(and(eq(warningCategories.name, name), ne(warningCategories.id, id)));
  if (dup) fail("มีประเภทนี้อยู่แล้ว");
  await db.update(warningCategories).set({ name }).where(eq(warningCategories.id, id));
  await audit(u.id, "update", "warning_category", id, { name });
  redirect(withMsg(P, { ok: "แก้ชื่อประเภทแล้ว" }));
}

/** เปิด/ปิดการใช้งาน (ไม่ลบ เพื่อให้ใบเตือนเก่ายังอ้างอิงได้) */
export async function toggleWarningCategory(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id"));
  const active = fd.get("active") === "1";
  await db.update(warningCategories).set({ active }).where(eq(warningCategories.id, id));
  await audit(u.id, active ? "enable" : "disable", "warning_category", id);
  redirect(withMsg(P, { ok: active ? "เปิดใช้งานประเภทแล้ว" : "ปิดการใช้งานประเภทแล้ว (ใบเตือนเก่ายังแสดงตามเดิม)" }));
}
