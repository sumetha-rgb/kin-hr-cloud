"use server";

import { and, count, eq, gte, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { certificateRequests, employees } from "@/db/schema";
import { audit } from "@/lib/audit";
import { isHR, requireUser } from "@/lib/auth";
import { parseForm } from "@/lib/form";
import { hrUserIds, notify, userIdsOfEmployees } from "@/lib/notify";
import { bkkDateStr } from "@/lib/time";
import { buildCertSnapshot, CERT_LABEL } from "@/lib/certificate";
import { withMsg } from "@/lib/util";

const P = "/certificates";
const fail = (error: string): never => redirect(withMsg(P, { error }));

export async function requestCertificate(fd: FormData) {
  const u = await requireUser();
  if (!u.employeeId) return fail("บัญชีนี้ไม่ได้ผูกกับพนักงาน");
  const r = parseForm(
    z.object({
      kind: z.enum(["employment", "salary"]),
      purpose: z.string().min(2, "ระบุว่าจะนำไปใช้ทำอะไร").max(200),
      copies: z.coerce.number().int().min(1).max(5).default(1),
    }),
    fd,
  );
  if (!r.ok) return fail(r.error);
  const [row] = await db
    .insert(certificateRequests)
    .values({ employeeId: u.employeeId, ...r.data })
    .returning({ id: certificateRequests.id });
  await audit(u.id, "create", "certificate", row.id, r.data);
  await notify(await hrUserIds(u.id), {
    kind: "request_new",
    title: `ขอ${CERT_LABEL[r.data.kind]}: ${u.displayName}`,
    body: `เพื่อ ${r.data.purpose} · ${r.data.copies} ฉบับ`,
    href: P,
  });
  redirect(withMsg(P, { ok: "ส่งคำขอแล้ว ฝ่ายบุคคลจะตรวจสอบและออกหนังสือให้" }));
}

export async function cancelCertificate(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const done = await db
    .update(certificateRequests)
    .set({ status: "cancelled" })
    .where(and(eq(certificateRequests.id, id), eq(certificateRequests.employeeId, u.employeeId ?? -1), eq(certificateRequests.status, "pending")))
    .returning({ id: certificateRequests.id });
  if (!done.length) return fail("ยกเลิกไม่ได้");
  redirect(withMsg(P, { ok: "ยกเลิกคำขอแล้ว" }));
}

/** HR อนุมัติ (ออกเลขที่หนังสือ) หรือไม่อนุมัติ */
export async function decideCertificate(fd: FormData) {
  const u = await requireUser();
  if (!isHR(u)) return fail("เฉพาะฝ่ายบุคคล");
  const id = Number(fd.get("id"));
  const decision = fd.get("decision") === "approved" ? "approved" : "rejected";
  const note = String(fd.get("note") ?? "").trim() || null;
  const [req] = await db.select().from(certificateRequests).where(eq(certificateRequests.id, id));
  if (!req || req.status !== "pending") return fail("คำขอนี้ถูกดำเนินการไปแล้ว");
  if (req.employeeId === u.employeeId) return fail("อนุมัติคำขอของตัวเองไม่ได้");
  if (decision === "approved" && req.kind === "salary") {
    const [e] = await db.select({ base: employees.baseSalary }).from(employees).where(eq(employees.id, req.employeeId));
    if (!e || Number(e.base) <= 0) return fail("ยังไม่ได้กรอกเงินเดือนของพนักงานคนนี้ — แก้ที่หน้าพนักงานก่อนออกหนังสือรับรองเงินเดือน");
  }

  // เลขที่หนังสือ: ปี พ.ศ./ลำดับในปี
  const year = Number(bkkDateStr().slice(0, 4));
  let docNo: string | null = null;
  if (decision === "approved") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(certificateRequests)
      .where(and(isNotNull(certificateRequests.docNo), gte(certificateRequests.decidedAt, new Date(`${year}-01-01T00:00:00+07:00`))));
    docNo = `${year + 543}/${String(n + 1).padStart(4, "0")}`;
  }
  // เก็บข้อมูล ณ วันออก — ขึ้นเงินเดือน/ย้ายตำแหน่งภายหลัง ฉบับนี้ไม่เปลี่ยน
  const snapshot = decision === "approved" ? await buildCertSnapshot(req.employeeId, u.id) : null;
  const done = await db
    .update(certificateRequests)
    .set({ status: decision, decidedBy: u.id, decidedAt: new Date(), decisionNote: note, docNo, snapshot })
    .where(and(eq(certificateRequests.id, id), eq(certificateRequests.status, "pending")))
    .returning({ id: certificateRequests.id });
  if (!done.length) return fail("คำขอนี้ถูกดำเนินการไปแล้ว");
  await audit(u.id, decision, "certificate", id, { docNo, note });
  const [emp] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, req.employeeId));
  const uid = emp ? (await userIdsOfEmployees([emp.id])).get(emp.id) : undefined;
  if (uid)
    await notify([uid], {
      kind: "request_decided",
      title: decision === "approved" ? `${CERT_LABEL[req.kind]}พร้อมแล้ว` : `ไม่อนุมัติ${CERT_LABEL[req.kind]}`,
      body: decision === "approved" ? `เลขที่ ${docNo} · เปิดเพื่อพิมพ์หรือบันทึกเป็น PDF` : (note ?? undefined),
      href: decision === "approved" ? `/certificates/${id}` : P,
    });
  redirect(withMsg(decision === "approved" ? `/certificates/${id}` : P, { ok: decision === "approved" ? `ออกหนังสือเลขที่ ${docNo} แล้ว` : "บันทึกผลแล้ว" }));
}
