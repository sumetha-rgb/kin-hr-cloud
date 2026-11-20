"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { payrollItems, payrollRuns } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { notify, userIdsOfEmployees } from "@/lib/notify";
import { calculateRun, recalcItemTotals } from "@/lib/payroll-run";
import { fmtMonth } from "@/lib/time";
import { withMsg } from "@/lib/util";

const fail = (p: string, error: string): never => redirect(withMsg(p, { error }));

export async function createRun(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const year = Number(fd.get("year"));
  const month = Number(fd.get("month"));
  if (!(year >= 2000 && year <= 2100 && month >= 1 && month <= 12)) return fail("/payroll", "งวดไม่ถูกต้อง");
  const [exists] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.year, year), eq(payrollRuns.month, month)));
  if (exists) redirect(`/payroll/${exists.id}`);
  const [run] = await db.insert(payrollRuns).values({ year, month, createdBy: u.id }).returning();
  let n = 0;
  try {
    n = await calculateRun(run.id);
  } catch (e) {
    return fail(`/payroll/${run.id}`, (e as Error).message);
  }
  await audit(u.id, "create", "payroll_run", run.id, { year, month });
  redirect(withMsg(`/payroll/${run.id}`, { ok: `คำนวณเงินเดือน ${n} คนแล้ว` }));
}

export async function recalcRun(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id"));
  let n = 0;
  try {
    n = await calculateRun(id);
  } catch (e) {
    return fail(`/payroll/${id}`, (e as Error).message);
  }
  await audit(u.id, "recalculate", "payroll_run", id);
  redirect(withMsg(`/payroll/${id}`, { ok: `คำนวณใหม่ ${n} คนแล้ว` }));
}

export async function adjustItem(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const runId = Number(fd.get("runId"));
  const itemId = Number(fd.get("itemId"));
  const otherIncome = Number(fd.get("otherIncome") || 0);
  const otherDeduction = Number(fd.get("otherDeduction") || 0);
  if (!(otherIncome >= 0 && otherDeduction >= 0)) return fail(`/payroll/${runId}`, "จำนวนเงินไม่ถูกต้อง");
  const [item] = await db.select({ runId: payrollItems.runId }).from(payrollItems).where(eq(payrollItems.id, itemId));
  if (item?.runId !== runId) return fail(`/payroll/${runId}`, "ไม่พบรายการ");
  try {
    await recalcItemTotals(itemId, otherIncome.toFixed(2), otherDeduction.toFixed(2));
  } catch (e) {
    return fail(`/payroll/${runId}`, (e as Error).message);
  }
  await audit(u.id, "adjust", "payroll_item", itemId, { otherIncome, otherDeduction });
  redirect(withMsg(`/payroll/${runId}`, { ok: "ปรับปรุงรายการแล้ว" }));
}

export async function finalizeRun(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id"));
  try {
    await calculateRun(id);
  } catch (e) {
    return fail(`/payroll/${id}`, (e as Error).message);
  }
  const [run] = await db.update(payrollRuns).set({ status: "finalized", finalizedAt: new Date() }).where(eq(payrollRuns.id, id)).returning();
  await audit(u.id, "finalize", "payroll_run", id);

  // แจ้งพนักงานทุกคนในงวดว่าสลิปออกแล้ว (ไม่ใส่ยอดเงินในข้อความ — ดูได้หลังเข้าสู่ระบบเท่านั้น)
  const empIds = (await db.select({ e: payrollItems.employeeId }).from(payrollItems).where(eq(payrollItems.runId, id))).map((r) => r.e);
  const userOf = await userIdsOfEmployees(empIds);
  const empOf = new Map([...userOf].map(([emp, user]) => [user, emp]));
  await notify([...userOf.values()], (userId) => ({
    kind: "payslip",
    title: `สลิปเงินเดือน${fmtMonth(run.year, run.month)}ออกแล้ว`,
    body: "แตะเพื่อดูสลิปของคุณ",
    href: `/payroll/${id}/slip/${empOf.get(userId)}`,
  }));
  redirect(withMsg(`/payroll/${id}`, { ok: "ปิดงวดแล้ว พนักงานดูสลิปได้" }));
}

export async function reopenRun(fd: FormData) {
  const u = await requireRole("admin");
  const id = Number(fd.get("id"));
  await db.update(payrollRuns).set({ status: "draft", finalizedAt: null }).where(eq(payrollRuns.id, id));
  await audit(u.id, "reopen", "payroll_run", id);
  redirect(withMsg(`/payroll/${id}`, { ok: "เปิดงวดให้แก้ไขได้อีกครั้ง" }));
}

export async function deleteRun(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id"));
  const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id));
  if (run?.status === "finalized") return fail(`/payroll/${id}`, "ลบงวดที่ปิดแล้วไม่ได้");
  await db.delete(payrollRuns).where(eq(payrollRuns.id, id));
  await audit(u.id, "delete", "payroll_run", id);
  redirect(withMsg("/payroll", { ok: "ลบงวดแล้ว" }));
}
