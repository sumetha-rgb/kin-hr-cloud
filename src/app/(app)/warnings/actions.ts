"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { employees, warnings } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireRole, requireUser } from "@/lib/auth";
import { parseForm, zBool, zDate } from "@/lib/form";
import { notify, userIdsOfEmployees } from "@/lib/notify";
import { bkkDateStr } from "@/lib/time";
import { withMsg } from "@/lib/util";
import { WARNING_CATEGORIES, WARNING_LEVEL } from "@/lib/warning";

const fail = (p: string, error: string): never => redirect(withMsg(p, { error }));

const issueSchema = z.object({
  employeeId: z.coerce.number().int().positive("เลือกพนักงาน"),
  level: z.enum(["verbal", "written", "final"]),
  category: z.enum(WARNING_CATEGORIES as [string, ...string[]], "เลือกประเภทความผิด"),
  incidentDate: zDate,
  reason: z.string().min(10, "กรอกเหตุผล/รายละเอียดอย่างน้อย 10 ตัวอักษร").max(2000),
  action: z.string().max(1000).optional(),
  notify: zBool,
});

/** HR ออกใบเตือน */
export async function issueWarning(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const P = `/warnings/new?employee=${fd.get("employeeId") ?? ""}`;
  const r = parseForm(issueSchema, fd);
  if (!r.ok) return fail(P, r.error);
  const v = r.data;
  if (v.incidentDate > bkkDateStr()) return fail(P, "วันที่เกิดเหตุต้องไม่เป็นวันในอนาคต");
  const [emp] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, v.employeeId));
  if (!emp) return fail(P, "ไม่พบพนักงาน");

  const [w] = await db
    .insert(warnings)
    .values({ employeeId: v.employeeId, level: v.level, category: v.category, incidentDate: v.incidentDate, reason: v.reason, action: v.action ?? null, issuedBy: u.id })
    .returning({ id: warnings.id });
  await audit(u.id, "issue_warning", "warning", w.id, { employeeId: v.employeeId, level: v.level, category: v.category });

  if (v.notify) {
    await notify([...(await userIdsOfEmployees([v.employeeId])).values()], {
      kind: "warning",
      title: `คุณได้รับ${WARNING_LEVEL[v.level].short}`,
      body: "กรุณาเปิดอ่านรายละเอียดและกดรับทราบ",
      href: `/warnings/${w.id}`,
    });
  }
  redirect(withMsg(`/warnings/${w.id}`, { ok: v.notify ? "ออกใบเตือนและแจ้งพนักงานแล้ว" : "ออกใบเตือนแล้ว" }));
}

/** พนักงานกดรับทราบ (เขียนคำชี้แจงได้) */
export async function acknowledgeWarning(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const P = `/warnings/${id}`;
  const note = String(fd.get("employeeNote") ?? "").trim().slice(0, 1000) || null;
  const [w] = await db.select().from(warnings).where(eq(warnings.id, id));
  if (!w || w.employeeId !== u.employeeId) return fail(P, "ไม่พบใบเตือน");
  if (w.voidedAt) return fail(P, "ใบเตือนนี้ถูกยกเลิกแล้ว");
  const done = await db
    .update(warnings)
    .set({ acknowledgedAt: new Date(), employeeNote: note })
    .where(and(eq(warnings.id, id), isNull(warnings.acknowledgedAt)))
    .returning({ id: warnings.id });
  if (!done.length) return fail(P, "รับทราบไปแล้ว");
  await audit(u.id, "acknowledge_warning", "warning", id, { note });
  if (w.issuedBy) {
    await notify([w.issuedBy], {
      kind: "warning",
      title: `${u.displayName} รับทราบใบเตือนแล้ว`,
      body: note ? `คำชี้แจง: ${note.slice(0, 120)}` : undefined,
      href: P,
    });
  }
  redirect(withMsg(P, { ok: "บันทึกการรับทราบแล้ว" }));
}

/** HR ยกเลิกใบเตือน (เก็บประวัติไว้ ไม่ลบ) */
export async function voidWarning(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id"));
  const P = `/warnings/${id}`;
  const reason = String(fd.get("voidReason") ?? "").trim();
  if (reason.length < 5) return fail(P, "กรุณาระบุเหตุผลที่ยกเลิก");
  await db.update(warnings).set({ voidedAt: new Date(), voidReason: reason.slice(0, 500) }).where(and(eq(warnings.id, id), isNull(warnings.voidedAt)));
  await audit(u.id, "void_warning", "warning", id, { reason });
  redirect(withMsg(P, { ok: "ยกเลิกใบเตือนแล้ว" }));
}
