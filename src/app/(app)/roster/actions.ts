"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employees, shiftAssignments, shiftSwaps } from "@/db/schema";
import { approversOf, teamOf } from "@/lib/approval";
import { audit } from "@/lib/audit";
import { isHR, requireUser, type CurrentUser } from "@/lib/auth";
import { hrUserIds, notify, userIdsOfEmployees } from "@/lib/notify";
import { effectiveShiftId, loadRoster, shiftsById, shiftShort } from "@/lib/roster";
import { bkkDateStr, fmtDate } from "@/lib/time";
import { fullName, withMsg } from "@/lib/util";

const back = (fd: FormData, def: string) => String(fd.get("back") || def);
const fail = (p: string, error: string): never => redirect(withMsg(p, { error }));

/** พนักงานที่ผู้ใช้จัดเวรได้: HR = ทุกคน · หัวหน้า = ลูกทีม */
async function canManage(u: CurrentUser, employeeIds: number[]) {
  if (isHR(u)) return true;
  if (!u.employeeId || u.role === "employee") return false;
  const team = new Set(await teamOf(u.employeeId));
  return employeeIds.every((id) => team.has(id));
}

/* ------------------------------ จัดตารางเวร ------------------------------ */
export async function saveRoster(fd: FormData) {
  const u = await requireUser();
  const P = back(fd, "/roster");
  const start = String(fd.get("start"));
  const end = String(fd.get("end"));
  const empIds = fd.getAll("emp").map(Number).filter(Boolean);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || !empIds.length) return fail(P, "ข้อมูลไม่ครบ");
  if (!(await canManage(u, empIds))) return fail(P, "จัดเวรได้เฉพาะลูกทีมของคุณ");

  const rows: Array<typeof shiftAssignments.$inferInsert> = [];
  for (const [k, v] of fd.entries()) {
    const m = /^c_(\d+)_(\d{4}-\d{2}-\d{2})$/.exec(k);
    if (!m || v === "") continue; // ว่าง = ตามกะประจำ
    const employeeId = Number(m[1]);
    if (!empIds.includes(employeeId) || m[2] < start || m[2] > end) continue;
    rows.push({ employeeId, date: m[2], shiftId: v === "off" ? null : Number(v), updatedBy: u.id, updatedAt: new Date() });
  }
  await db.delete(shiftAssignments).where(and(inArray(shiftAssignments.employeeId, empIds), gte(shiftAssignments.date, start), lte(shiftAssignments.date, end)));
  for (let i = 0; i < rows.length; i += 200) await db.insert(shiftAssignments).values(rows.slice(i, i + 200));
  await audit(u.id, "update", "roster", undefined, { start, end, employees: empIds.length, cells: rows.length });
  redirect(withMsg(P, { ok: `บันทึกตารางเวรแล้ว (${rows.length} ช่องที่จัดไว้)` }));
}

/* -------------------------------- แลกเวร -------------------------------- */
export async function requestSwap(fd: FormData) {
  const u = await requireUser();
  const P = "/roster/me";
  if (!u.employeeId) return fail(P, "บัญชีนี้ไม่ได้ผูกกับพนักงาน");
  const partnerId = Number(fd.get("partnerId"));
  const requesterDate = String(fd.get("requesterDate") ?? "");
  const partnerDate = String(fd.get("partnerDate") || requesterDate);
  const reason = String(fd.get("reason") ?? "").trim() || null;
  const today = bkkDateStr();
  if (!partnerId || partnerId === u.employeeId) return fail(P, "เลือกเพื่อนที่จะแลกเวรด้วย");
  if (requesterDate < today || partnerDate < today) return fail(P, "แลกได้เฉพาะเวรตั้งแต่วันนี้เป็นต้นไป");
  const [me, partner] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, u.employeeId)),
    db.select().from(employees).where(eq(employees.id, partnerId)),
  ]).then((r) => r.map((x) => x[0]));
  if (!partner || partner.departmentId !== me.departmentId) return fail(P, "แลกเวรได้เฉพาะคนในแผนกเดียวกัน");

  const [roster, byId] = await Promise.all([
    loadRoster(requesterDate < partnerDate ? requesterDate : partnerDate, requesterDate > partnerDate ? requesterDate : partnerDate, [me.id, partner.id]),
    shiftsById(),
  ]);
  const mine = effectiveShiftId(me, requesterDate, roster, byId);
  const theirs = effectiveShiftId(partner, partnerDate, roster, byId);
  if (requesterDate === partnerDate && mine === theirs) return fail(P, "วันนั้นทั้งสองคนเข้ากะเดียวกันอยู่แล้ว");

  const [row] = await db.insert(shiftSwaps).values({ requesterId: me.id, partnerId, requesterDate, partnerDate, reason }).returning({ id: shiftSwaps.id });
  await audit(u.id, "create", "shift_swap", row.id, { partnerId, requesterDate, partnerDate });
  const pu = (await userIdsOfEmployees([partnerId])).get(partnerId);
  if (pu)
    await notify([pu], {
      kind: "request_new",
      title: `${fullName(me)} ขอแลกเวรกับคุณ`,
      body:
        requesterDate === partnerDate
          ? `วันที่ ${fmtDate(requesterDate)}: เขา ${shiftShort(mine ? byId.get(mine) : null)} ↔ คุณ ${shiftShort(theirs ? byId.get(theirs) : null)}`
          : `คุณทำแทนเขา ${fmtDate(requesterDate)} · เขาทำแทนคุณ ${fmtDate(partnerDate)}`,
      href: P,
    });
  redirect(withMsg(P, { ok: "ส่งคำขอแลกเวรแล้ว รอเพื่อนตอบรับ แล้วหัวหน้าอนุมัติ" }));
}

/** เพื่อนตอบรับ / ปฏิเสธ */
export async function respondSwap(fd: FormData) {
  const u = await requireUser();
  const P = "/roster/me";
  const id = Number(fd.get("id"));
  const accept = fd.get("decision") === "accept";
  const [s] = await db.select().from(shiftSwaps).where(eq(shiftSwaps.id, id));
  if (!s || s.partnerId !== u.employeeId || s.status !== "pending_partner") return fail(P, "คำขอนี้ไม่อยู่ในสถานะที่ตอบได้");
  await db
    .update(shiftSwaps)
    .set({ status: accept ? "pending_head" : "rejected", partnerAt: new Date(), ...(accept ? {} : { decisionNote: "เพื่อนปฏิเสธ" }) })
    .where(eq(shiftSwaps.id, id));
  const ru = (await userIdsOfEmployees([s.requesterId])).get(s.requesterId);
  if (ru) await notify([ru], { kind: "request_decided", title: accept ? `${u.displayName} ตอบรับแลกเวรแล้ว · รอหัวหน้าอนุมัติ` : `${u.displayName} ปฏิเสธการแลกเวร`, href: P });
  if (accept) {
    const { headId, actingId } = await approversOf(s.requesterId);
    const approvers = headId ? [...(await userIdsOfEmployees([headId, ...(actingId ? [actingId] : [])])).values()] : await hrUserIds();
    await notify(approvers, {
      kind: "request_new",
      title: "คำขอแลกเวรรออนุมัติ",
      body: `${fmtDate(s.requesterDate)}${s.partnerDate !== s.requesterDate ? ` ↔ ${fmtDate(s.partnerDate)}` : ""}`,
      href: "/roster",
    });
  }
  redirect(withMsg(P, { ok: accept ? "ตอบรับแล้ว รอหัวหน้าอนุมัติ" : "ปฏิเสธแล้ว" }));
}

/** หัวหน้า (หรือผู้อนุมัติแทน / HR ถ้าไม่มีหัวหน้า) อนุมัติ → สลับเวรในตารางทันที */
export async function decideSwap(fd: FormData) {
  const u = await requireUser();
  const P = back(fd, "/roster");
  const id = Number(fd.get("id"));
  const approve = fd.get("decision") === "approved";
  const note = String(fd.get("note") ?? "").trim() || null;
  const [s] = await db.select().from(shiftSwaps).where(eq(shiftSwaps.id, id));
  if (!s || s.status !== "pending_head") return fail(P, "คำขอนี้ถูกดำเนินการไปแล้ว");
  const { headId, actingId } = await approversOf(s.requesterId);
  const allowed = headId ? u.employeeId === headId || u.employeeId === actingId : isHR(u);
  if (!allowed || u.employeeId === s.requesterId || u.employeeId === s.partnerId) return fail(P, "คำขอนี้ต้องให้หัวหน้าของผู้ขออนุมัติ");

  const done = await db
    .update(shiftSwaps)
    .set({ status: approve ? "approved" : "rejected", decidedBy: u.id, decidedAt: new Date(), decisionNote: note })
    .where(and(eq(shiftSwaps.id, id), eq(shiftSwaps.status, "pending_head")))
    .returning({ id: shiftSwaps.id });
  if (!done.length) return fail(P, "คำขอนี้ถูกดำเนินการไปแล้ว");

  if (approve) {
    // สลับกะของทั้งสองคนในวันที่เกี่ยวข้อง (วันเดียว = สลับกะ, สองวัน = ทำแทนกัน)
    const dates = [...new Set([s.requesterDate, s.partnerDate])];
    const [emps, roster, byId] = await Promise.all([
      db
        .select()
        .from(employees)
        .where(inArray(employees.id, [s.requesterId, s.partnerId])),
      loadRoster(
        dates.reduce((a, b) => (a < b ? a : b)),
        dates.reduce((a, b) => (a > b ? a : b)),
        [s.requesterId, s.partnerId],
      ),
      shiftsById(),
    ]);
    const a = emps.find((e) => e.id === s.requesterId)!;
    const b = emps.find((e) => e.id === s.partnerId)!;
    for (const d of dates) {
      const sa = effectiveShiftId(a, d, roster, byId);
      const sb = effectiveShiftId(b, d, roster, byId);
      for (const [emp, shiftId] of [
        [a.id, sb],
        [b.id, sa],
      ] as const)
        await db
          .insert(shiftAssignments)
          .values({ employeeId: emp, date: d, shiftId, updatedBy: u.id })
          .onConflictDoUpdate({ target: [shiftAssignments.employeeId, shiftAssignments.date], set: { shiftId, updatedBy: u.id, updatedAt: new Date() } });
    }
  }
  await audit(u.id, approve ? "approved" : "rejected", "shift_swap", id, { note });
  const users = [...(await userIdsOfEmployees([s.requesterId, s.partnerId])).values()];
  await notify(users, {
    kind: "request_decided",
    title: approve ? "หัวหน้าอนุมัติการแลกเวรแล้ว" : "หัวหน้าไม่อนุมัติการแลกเวร",
    body: note ?? `${fmtDate(s.requesterDate)}${s.partnerDate !== s.requesterDate ? ` ↔ ${fmtDate(s.partnerDate)}` : ""}`,
    href: "/roster/me",
  });
  if (approve && headId)
    await notify(await hrUserIds(u.id), {
      kind: "system",
      title: "มีการแลกเวร (หัวหน้าอนุมัติแล้ว)",
      body: `${fmtDate(s.requesterDate)}${s.partnerDate !== s.requesterDate ? ` ↔ ${fmtDate(s.partnerDate)}` : ""} · อนุมัติโดย ${u.displayName}`,
      href: "/roster",
    });
  redirect(withMsg(P, { ok: approve ? "อนุมัติแล้ว ตารางเวรอัปเดตให้อัตโนมัติ" : "บันทึกผลแล้ว" }));
}

export async function cancelSwap(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const done = await db
    .update(shiftSwaps)
    .set({ status: "cancelled" })
    .where(and(eq(shiftSwaps.id, id), eq(shiftSwaps.requesterId, u.employeeId ?? -1), inArray(shiftSwaps.status, ["pending_partner", "pending_head"])))
    .returning({ id: shiftSwaps.id });
  redirect(withMsg("/roster/me", done.length ? { ok: "ยกเลิกคำขอแลกเวรแล้ว" } : { error: "ยกเลิกไม่ได้" }));
}
