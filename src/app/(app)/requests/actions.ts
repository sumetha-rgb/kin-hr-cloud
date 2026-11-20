"use server";

import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { attendanceLogs, employees, holidays, leaveTypes, requests, shifts } from "@/db/schema";
import { DEFAULT_SHIFT, isWorkDay } from "@/lib/attendance";
import { audit } from "@/lib/audit";
import { canDecide, HEAD_IS_FINAL, headOf, stageOf } from "@/lib/approval";
import { requireUser } from "@/lib/auth";
import { parseForm, zBool, zDate, zTime } from "@/lib/form";
import { hrUserIds, notify, userIdsOfEmployees } from "@/lib/notify";
import { atBkk, eachDate, fmtDate } from "@/lib/time";
import { REQUEST_TYPE_LABEL, withMsg } from "@/lib/util";

const fail = (p: string, error: string): never => redirect(withMsg(p, { error }));

const leaveSchema = z.object({
  type: z.literal("leave"),
  leaveTypeId: z.coerce.number().int(),
  startDate: zDate,
  endDate: zDate,
  halfDay: zBool,
  reason: z.string().optional(),
});
const otSchema = z.object({
  type: z.literal("ot"),
  otDate: zDate,
  otHours: z.coerce.number().min(0.5).max(16),
  otRate: z.enum(["1.0", "1.5", "2.0", "3.0"]),
  reason: z.string().min(1, "กรุณาระบุงานที่ทำ"),
});
const correctionSchema = z.object({
  type: z.literal("time_correction"),
  date: zDate,
  time: zTime,
  correctionType: z.enum(["in", "out"]),
  reason: z.string().min(3, "กรุณาระบุเหตุผล"),
});

export async function createRequest(fd: FormData) {
  const u = await requireUser();
  const type = String(fd.get("type"));
  const P = `/requests/new?type=${type}`;
  if (!u.employeeId) return fail(P, "บัญชีนี้ไม่ได้ผูกกับพนักงาน");
  const empId = u.employeeId;

  if (type === "leave") {
    const r = parseForm(leaveSchema, fd);
    if (!r.ok) return fail(P, r.error);
    const v = r.data;
    if (v.endDate < v.startDate) return fail(P, "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
    if (v.halfDay && v.startDate !== v.endDate) return fail(P, "ลาครึ่งวันได้เฉพาะวันเดียว");

    const [[lt], [emp], hol] = await Promise.all([
      db.select().from(leaveTypes).where(eq(leaveTypes.id, v.leaveTypeId)),
      db.select({ shift: shifts }).from(employees).leftJoin(shifts, eq(employees.shiftId, shifts.id)).where(eq(employees.id, empId)),
      db.select({ date: holidays.date }).from(holidays).where(and(gte(holidays.date, v.startDate), lte(holidays.date, v.endDate))),
    ]);
    if (!lt) return fail(P, "ไม่พบประเภทการลา");
    const holSet = new Set(hol.map((h) => h.date));
    const shift = emp?.shift ?? DEFAULT_SHIFT;
    const workDays = eachDate(v.startDate, v.endDate).filter((d) => isWorkDay(d, shift) && !holSet.has(d)).length;
    if (workDays === 0) return fail(P, "ช่วงวันที่เลือกไม่มีวันทำงาน");
    const days = v.halfDay ? 0.5 : workDays;

    const overlap = await db
      .select({ id: requests.id })
      .from(requests)
      .where(
        and(
          eq(requests.employeeId, empId),
          eq(requests.type, "leave"),
          inArray(requests.status, ["pending", "approved"]),
          lte(requests.startDate, v.endDate),
          gte(requests.endDate, v.startDate),
        ),
      );
    if (overlap.length) return fail(P, "มีใบลาที่ทับช่วงวันที่นี้อยู่แล้ว");

    if (lt.daysPerYear > 0) {
      const year = v.startDate.slice(0, 4);
      const [{ used }] = await db
        .select({ used: sql<string>`coalesce(sum(${requests.days}), 0)` })
        .from(requests)
        .where(
          and(
            eq(requests.employeeId, empId),
            eq(requests.leaveTypeId, lt.id),
            inArray(requests.status, ["pending", "approved"]),
            gte(requests.startDate, `${year}-01-01`),
            lte(requests.startDate, `${year}-12-31`),
          ),
        );
      if (Number(used) + days > lt.daysPerYear) return fail(P, `สิทธิ์${lt.name}คงเหลือ ${lt.daysPerYear - Number(used)} วัน (ขอ ${days} วัน)`);
    }

    await db.insert(requests).values({
      type: "leave",
      employeeId: empId,
      leaveTypeId: lt.id,
      startDate: v.startDate,
      endDate: v.endDate,
      days: String(days),
      reason: v.reason ?? null,
    });
  } else if (type === "ot") {
    const r = parseForm(otSchema, fd);
    if (!r.ok) return fail(P, r.error);
    const v = r.data;
    await db.insert(requests).values({ type: "ot", employeeId: empId, otDate: v.otDate, otHours: v.otHours.toFixed(2), otRate: v.otRate, reason: v.reason });
  } else if (type === "time_correction") {
    const r = parseForm(correctionSchema, fd);
    if (!r.ok) return fail(P, r.error);
    const v = r.data;
    const at = atBkk(v.date, v.time);
    if (at > new Date()) return fail(P, "ขอแก้ไขเวลาล่วงหน้าไม่ได้");
    await db.insert(requests).values({ type: "time_correction", employeeId: empId, correctionAt: at, correctionType: v.correctionType, reason: v.reason });
  } else {
    return fail("/requests/new", "ประเภทคำขอไม่ถูกต้อง");
  }

  // แจ้งผู้อนุมัติขั้นแรก: หัวหน้า (รายคน/หัวหน้าแผนก) — ถ้าไม่มีหัวหน้า ส่งตรงถึง HR
  const headId = await headOf(empId);
  const approvers = headId ? [...(await userIdsOfEmployees([headId])).values()] : await hrUserIds(u.id);
  await notify(approvers, {
    kind: "request_new",
    title: `คำขอใหม่รออนุมัติ: ${REQUEST_TYPE_LABEL[type as keyof typeof REQUEST_TYPE_LABEL] ?? ""}`,
    body: `จาก ${u.displayName}`,
    href: "/requests/inbox",
  });
  redirect(withMsg("/requests", { ok: headId ? "ส่งคำขอแล้ว รอหัวหน้าแผนกอนุมัติ" : "ส่งคำขอแล้ว รอ HR อนุมัติ" }));
}

export async function cancelRequest(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const [r] = await db.select().from(requests).where(eq(requests.id, id));
  if (!r || r.employeeId !== u.employeeId) return fail("/requests", "ไม่พบคำขอ");
  if (r.status !== "pending") return fail("/requests", "ยกเลิกได้เฉพาะคำขอที่รออนุมัติ");
  await db.update(requests).set({ status: "cancelled" }).where(eq(requests.id, id));
  redirect(withMsg("/requests", { ok: "ยกเลิกคำขอแล้ว" }));
}

export async function decideRequest(fd: FormData) {
  const u = await requireUser();
  const P = "/requests/inbox";
  const id = Number(fd.get("id"));
  const decision = String(fd.get("decision"));
  const note = String(fd.get("note") ?? "").trim() || null;
  if (decision !== "approved" && decision !== "rejected") return fail(P, "คำสั่งไม่ถูกต้อง");

  const [r] = await db.select().from(requests).where(eq(requests.id, id));
  if (!r || r.status !== "pending") return fail(P, "คำขอนี้ถูกดำเนินการไปแล้ว");
  const headId = await headOf(r.employeeId);
  const stage = stageOf(r, headId);
  if (!canDecide(u, r, headId)) {
    return fail(P, stage === "head" ? "คำขอนี้ต้องให้หัวหน้าแผนกอนุมัติก่อน" : "คุณไม่มีสิทธิ์อนุมัติคำขอนี้");
  }
  const typeLabel = REQUEST_TYPE_LABEL[r.type];
  const [emp] = await db.select({ firstName: employees.firstName, lastName: employees.lastName }).from(employees).where(eq(employees.id, r.employeeId));
  const empName = emp ? `${emp.firstName} ${emp.lastName}` : "";
  const requester = [...(await userIdsOfEmployees([r.employeeId])).values()];

  // ---------- ขั้นที่ 1: หัวหน้าอนุมัติ (ลา/แก้เวลา → ส่งต่อ HR) ----------
  if (stage === "head" && decision === "approved" && !HEAD_IS_FINAL.has(r.type)) {
    const done = await db
      .update(requests)
      .set({ headApprovedBy: u.id, headApprovedAt: new Date(), headNote: note })
      .where(and(eq(requests.id, id), eq(requests.status, "pending"), isNull(requests.headApprovedAt)))
      .returning({ id: requests.id });
    if (!done.length) return fail(P, "คำขอนี้ถูกดำเนินการไปแล้ว");
    await audit(u.id, "head_approved", "request", id, { type: r.type, note });
    await notify(await hrUserIds(u.id), {
      kind: "request_new",
      title: `รอ HR อนุมัติ: ${typeLabel}ของ ${empName}`,
      body: `หัวหน้าแผนก (${u.displayName}) อนุมัติแล้ว${note ? ` · ${note}` : ""}`,
      href: "/requests/inbox",
    });
    await notify(requester, { kind: "request_decided", title: `หัวหน้าแผนกอนุมัติคำขอ (${typeLabel}) แล้ว`, body: "รอ HR อนุมัติขั้นสุดท้าย", href: "/requests/mine" });
    redirect(withMsg(P, { ok: "อนุมัติแล้ว ส่งต่อให้ HR อนุมัติขั้นสุดท้าย" }));
  }

  // ---------- ผลสุดท้าย (HR / หัวหน้ากรณี OT / ไม่อนุมัติในขั้นใดก็ได้) ----------
  // อัปเดตแบบมีเงื่อนไข status = pending กันการกดอนุมัติซ้อนกัน 2 คน
  const now = new Date();
  const updated = await db
    .update(requests)
    .set({
      status: decision,
      decidedBy: u.id,
      decidedAt: now,
      decisionNote: note,
      ...(stage === "head" ? { headApprovedBy: u.id, headApprovedAt: now, headNote: note } : {}),
    })
    .where(and(eq(requests.id, id), eq(requests.status, "pending")))
    .returning({ id: requests.id });
  if (!updated.length) return fail(P, "คำขอนี้ถูกดำเนินการไปแล้ว");

  // OT ที่หัวหน้าอนุมัติ: แจ้ง HR ให้ทราบรายละเอียด
  if (decision === "approved" && r.type === "ot" && stage === "head") {
    await notify(await hrUserIds(u.id), {
      kind: "request_decided",
      title: `OT อนุมัติแล้ว: ${empName}`,
      body: `วันที่ ${fmtDate(r.otDate)} · ${Number(r.otHours)} ชม. × ${Number(r.otRate)} เท่า · อนุมัติโดย ${u.displayName}`,
      href: "/requests/history",
    });
  }

  if (decision === "approved" && r.type === "time_correction" && r.correctionAt && r.correctionType) {
    await db.insert(attendanceLogs).values({
      employeeId: r.employeeId,
      type: r.correctionType,
      punchedAt: r.correctionAt,
      method: "correction",
      note: `อนุมัติคำขอ #${r.id}: ${r.reason ?? ""}`.slice(0, 300),
      createdBy: u.id,
    });
  }
  await audit(u.id, decision, "request", id, { type: r.type, note });

  // แจ้งผู้ยื่นคำขอ
  await notify(requester, {
    kind: "request_decided",
    title: `คำขอของคุณ (${REQUEST_TYPE_LABEL[r.type]}) ${decision === "approved" ? "ได้รับการอนุมัติแล้ว" : "ไม่ได้รับการอนุมัติ"}`,
    body: note ? `หมายเหตุ: ${note}` : undefined,
    href: "/requests/mine",
  });
  redirect(withMsg(P, { ok: decision === "approved" ? "อนุมัติแล้ว" : "ไม่อนุมัติแล้ว" }));
}
