"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { branches, companySettings, departments, holidays, leaveTypes, positions, shifts } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { parseForm, zBool, zDate, zMoney, zOptInt, zTime } from "@/lib/form";
import { withMsg } from "@/lib/util";

const guard = () => requireRole("admin", "hr");

function done(path: string, ok: string): never {
  redirect(withMsg(path, { ok }));
}
function fail(path: string, error: string): never {
  redirect(withMsg(path, { error }));
}
/** แปลง error ของ Postgres ให้อ่านง่าย */
function dbError(e: unknown): string {
  const msg = String((e as { cause?: { code?: string } })?.cause?.code ?? (e as Error)?.message ?? e);
  if (msg.includes("23505")) return "ข้อมูลซ้ำกับที่มีอยู่แล้ว (รหัส/วันที่ซ้ำ)";
  if (msg.includes("23503")) return "ลบไม่ได้ เพราะมีข้อมูลอื่นอ้างอิงอยู่";
  return "บันทึกไม่สำเร็จ: " + msg;
}

/* --------------------------------- สาขา --------------------------------- */
const branchSchema = z.object({
  id: zOptInt,
  code: z.string().min(1).max(20),
  name: z.string().min(1),
  address: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusM: z.coerce.number().int().min(20).max(5000).default(150),
  active: zBool,
});

export async function saveBranch(fd: FormData) {
  const u = await guard();
  const P = "/organization/branches";
  const r = parseForm(branchSchema, fd);
  if (!r.ok) fail(P, r.error);
  const { id, ...v } = r.data;
  const values = { ...v, address: v.address ?? null, latitude: v.latitude ?? null, longitude: v.longitude ?? null };
  try {
    if (id) await db.update(branches).set(values).where(eq(branches.id, id));
    else await db.insert(branches).values(values);
  } catch (e) {
    fail(P, dbError(e));
  }
  await audit(u.id, id ? "update" : "create", "branch", id, values);
  done(P, "บันทึกสาขาแล้ว");
}

export async function deleteBranch(fd: FormData) {
  const u = await guard();
  const id = Number(fd.get("id"));
  try {
    await db.delete(branches).where(eq(branches.id, id));
  } catch (e) {
    fail("/organization/branches", dbError(e));
  }
  await audit(u.id, "delete", "branch", id);
  done("/organization/branches", "ลบสาขาแล้ว");
}

/* ----------------------------- แผนก / ตำแหน่ง ---------------------------- */
export async function saveDepartment(fd: FormData) {
  await guard();
  const P = "/organization/departments";
  const r = parseForm(z.object({ id: zOptInt, name: z.string().min(1), parentId: zOptInt }), fd);
  if (!r.ok) fail(P, r.error);
  const { id, name, parentId } = r.data;
  if (id && parentId === id) fail(P, "แผนกแม่ต้องไม่ใช่ตัวเอง");
  if (id) await db.update(departments).set({ name, parentId: parentId ?? null }).where(eq(departments.id, id));
  else await db.insert(departments).values({ name, parentId: parentId ?? null });
  done(P, "บันทึกแผนกแล้ว");
}

export async function deleteDepartment(fd: FormData) {
  await guard();
  await db.delete(departments).where(eq(departments.id, Number(fd.get("id"))));
  done("/organization/departments", "ลบแผนกแล้ว");
}

export async function savePosition(fd: FormData) {
  await guard();
  const P = "/organization/departments";
  const r = parseForm(z.object({ id: zOptInt, name: z.string().min(1), departmentId: zOptInt }), fd);
  if (!r.ok) fail(P, r.error);
  const { id, name, departmentId } = r.data;
  if (id) await db.update(positions).set({ name, departmentId: departmentId ?? null }).where(eq(positions.id, id));
  else await db.insert(positions).values({ name, departmentId: departmentId ?? null });
  done(P, "บันทึกตำแหน่งแล้ว");
}

export async function deletePosition(fd: FormData) {
  await guard();
  await db.delete(positions).where(eq(positions.id, Number(fd.get("id"))));
  done("/organization/departments", "ลบตำแหน่งแล้ว");
}

/* --------------------------------- กะงาน --------------------------------- */
export async function saveShift(fd: FormData) {
  const u = await guard();
  const P = "/organization/shifts";
  const days = fd.getAll("workDays").map(String).filter(Boolean);
  fd.delete("workDays");
  const r = parseForm(
    z.object({
      id: zOptInt,
      name: z.string().min(1),
      startTime: zTime,
      endTime: zTime,
      breakMinutes: z.coerce.number().int().min(0).max(600).default(60),
      lateGraceMinutes: z.coerce.number().int().min(0).max(240).default(0),
    }),
    fd,
  );
  if (!r.ok) fail(P, r.error);
  if (!days.length) fail(P, "เลือกวันทำงานอย่างน้อย 1 วัน");
  const { id, ...v } = r.data;
  const values = { ...v, workDays: days.sort().join(",") };
  if (id) await db.update(shifts).set(values).where(eq(shifts.id, id));
  else await db.insert(shifts).values(values);
  await audit(u.id, id ? "update" : "create", "shift", id, values);
  done(P, "บันทึกกะการทำงานแล้ว");
}

export async function deleteShift(fd: FormData) {
  await guard();
  await db.delete(shifts).where(eq(shifts.id, Number(fd.get("id"))));
  done("/organization/shifts", "ลบกะแล้ว");
}

/* -------------------------------- วันหยุด -------------------------------- */
export async function saveHoliday(fd: FormData) {
  await guard();
  const P = "/organization/holidays";
  const r = parseForm(z.object({ date: zDate, name: z.string().min(1) }), fd);
  if (!r.ok) fail(P, r.error);
  await db.insert(holidays).values(r.data).onConflictDoUpdate({ target: holidays.date, set: { name: r.data.name } });
  done(P, "บันทึกวันหยุดแล้ว");
}

export async function deleteHoliday(fd: FormData) {
  await guard();
  await db.delete(holidays).where(eq(holidays.id, Number(fd.get("id"))));
  done("/organization/holidays", "ลบวันหยุดแล้ว");
}

/* ------------------------------ ประเภทการลา ------------------------------ */
export async function saveLeaveType(fd: FormData) {
  await guard();
  const P = "/organization/leave-types";
  const r = parseForm(
    z.object({ id: zOptInt, code: z.string().min(1).max(20), name: z.string().min(1), paid: zBool, daysPerYear: z.coerce.number().int().min(0).default(0) }),
    fd,
  );
  if (!r.ok) fail(P, r.error);
  const { id, ...v } = r.data;
  try {
    if (id) await db.update(leaveTypes).set({ ...v, code: v.code.toUpperCase() }).where(eq(leaveTypes.id, id));
    else await db.insert(leaveTypes).values({ ...v, code: v.code.toUpperCase() });
  } catch (e) {
    fail(P, dbError(e));
  }
  done(P, "บันทึกประเภทการลาแล้ว");
}

export async function deleteLeaveType(fd: FormData) {
  await guard();
  try {
    await db.delete(leaveTypes).where(eq(leaveTypes.id, Number(fd.get("id"))));
  } catch (e) {
    fail("/organization/leave-types", dbError(e));
  }
  done("/organization/leave-types", "ลบประเภทการลาแล้ว");
}

/* ------------------------------ ตั้งค่าบริษัท ----------------------------- */
export async function saveSettings(fd: FormData) {
  const u = await guard();
  const P = "/organization/settings";
  const r = parseForm(
    z.object({
      name: z.string().min(1),
      taxId: z.string().optional(),
      address: z.string().optional(),
      ssoRate: z.coerce.number().min(0).max(20).transform((n) => n.toFixed(2)),
      ssoMinBase: zMoney,
      ssoMaxBase: zMoney,
      deductLate: zBool,
      maxGpsAccuracyM: z.coerce.number().int().min(10).max(2000),
    }),
    fd,
  );
  if (!r.ok) fail(P, r.error);
  const values = { ...r.data, taxId: r.data.taxId ?? null, address: r.data.address ?? null, updatedAt: new Date() };
  await db.insert(companySettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: companySettings.id, set: values });
  await audit(u.id, "update", "settings", 1, values);
  done(P, "บันทึกการตั้งค่าแล้ว");
}
