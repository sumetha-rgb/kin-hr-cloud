"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { employees, users, webauthnCredentials } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { parseForm, zBool, zDate, zMoney, zOptInt } from "@/lib/form";
import { withMsg } from "@/lib/util";

const fail = (p: string, error: string): never => redirect(withMsg(p, { error }));

const employeeSchema = z.object({
  id: zOptInt,
  code: z.string().min(1).max(30),
  prefix: z.string().optional(),
  firstName: z.string().min(1, "กรอกชื่อ"),
  lastName: z.string().min(1, "กรอกนามสกุล"),
  nickname: z.string().optional(),
  nationalId: z
    .string()
    .regex(/^\d{13}$/, "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก")
    .optional(),
  phone: z.string().optional(),
  email: z.email("อีเมลไม่ถูกต้อง").optional(),
  birthDate: zDate.optional(),
  startDate: zDate,
  endDate: zDate.optional(),
  status: z.enum(["probation", "active", "resigned"]),
  branchId: zOptInt,
  departmentId: zOptInt,
  positionId: zOptInt,
  shiftId: zOptInt,
  managerId: zOptInt,
  payType: z.enum(["monthly", "daily"]),
  baseSalary: zMoney,
  monthlyAllowance: zMoney,
  extraTaxAllowance: zMoney,
  ssoEnabled: zBool,
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  allowRemoteCheckin: zBool,
});

export async function saveEmployee(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id")) || undefined;
  const P = id ? `/personnel/${id}` : "/personnel/new";
  const r = parseForm(employeeSchema, fd);
  if (!r.ok) return fail(P, r.error);
  const { id: _id, ...v } = r.data;
  if (id && v.managerId === id) return fail(P, "หัวหน้างานต้องไม่ใช่ตัวเอง");
  if (v.status === "resigned" && !v.endDate) return fail(P, "กรุณาระบุวันที่พ้นสภาพ");

  const values = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === undefined ? null : val])) as typeof v;
  let savedId = id;
  try {
    if (id) {
      const [before] = await db.select().from(employees).where(eq(employees.id, id));
      await db.update(employees).set(values).where(eq(employees.id, id));
      if (before && (before.baseSalary !== values.baseSalary || before.payType !== values.payType)) {
        await audit(u.id, "salary_change", "employee", id, { from: before.baseSalary, to: values.baseSalary, payType: values.payType });
      }
    } else {
      const [row] = await db.insert(employees).values(values).returning({ id: employees.id });
      savedId = row.id;
    }
  } catch (e) {
    const code = (e as { cause?: { code?: string } })?.cause?.code;
    return fail(P, code === "23505" ? "รหัสพนักงานนี้มีอยู่แล้ว" : "บันทึกไม่สำเร็จ: " + (e as Error).message);
  }
  await audit(u.id, id ? "update" : "create", "employee", savedId);
  redirect(withMsg(`/personnel/${savedId}`, { ok: "บันทึกข้อมูลพนักงานแล้ว" }));
}

const accountSchema = z.object({
  employeeId: z.coerce.number().int(),
  username: z
    .string()
    .min(3, "ชื่อผู้ใช้อย่างน้อย 3 ตัวอักษร")
    .regex(/^[a-z0-9._-]+$/i, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ -")
    .transform((s) => s.toLowerCase()),
  role: z.enum(["admin", "hr", "manager", "employee"]),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").optional(),
  active: zBool,
});

export async function saveAccount(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const empId = Number(fd.get("employeeId"));
  const P = `/personnel/${empId}`;
  const r = parseForm(accountSchema, fd);
  if (!r.ok) return fail(P, r.error);
  const v = r.data;
  if (v.role === "admin" && u.role !== "admin") return fail(P, "เฉพาะผู้ดูแลระบบเท่านั้นที่กำหนดสิทธิ์ admin ได้");

  const [existing] = await db.select().from(users).where(eq(users.employeeId, empId));
  if (existing?.role === "admin" && u.role !== "admin") return fail(P, "แก้ไขบัญชีผู้ดูแลระบบไม่ได้");
  const [dup] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, v.username), existing ? ne(users.id, existing.id) : undefined));
  if (dup) return fail(P, "ชื่อผู้ใช้นี้ถูกใช้แล้ว");

  if (existing) {
    await db
      .update(users)
      .set({
        username: v.username,
        role: v.role,
        active: v.active,
        ...(v.password ? { passwordHash: await bcrypt.hash(v.password, 12) } : {}),
      })
      .where(eq(users.id, existing.id));
    await audit(u.id, v.password ? "update_with_password" : "update", "user", existing.id, { role: v.role, active: v.active });
  } else {
    if (!v.password) return fail(P, "กรุณาตั้งรหัสผ่านเริ่มต้น");
    const [row] = await db
      .insert(users)
      .values({ username: v.username, role: v.role, active: v.active, employeeId: empId, passwordHash: await bcrypt.hash(v.password, 12) })
      .returning({ id: users.id });
    await audit(u.id, "create", "user", row.id, { role: v.role });
  }
  redirect(withMsg(P, { ok: "บันทึกบัญชีผู้ใช้แล้ว" }));
}

/** ลบอุปกรณ์สแกนนิ้ว → พนักงานลงทะเบียนเครื่องใหม่ได้ (กรณีเปลี่ยนมือถือ) */
export async function removeCredential(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const empId = Number(fd.get("employeeId"));
  const credId = String(fd.get("credentialId"));
  await db.delete(webauthnCredentials).where(eq(webauthnCredentials.id, credId));
  await audit(u.id, "reset_device", "employee", empId, { credentialId: credId });
  redirect(withMsg(`/personnel/${empId}`, { ok: "ลบอุปกรณ์แล้ว พนักงานสามารถลงทะเบียนเครื่องใหม่ได้" }));
}
