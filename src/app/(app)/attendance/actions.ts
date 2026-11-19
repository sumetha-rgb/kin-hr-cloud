"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { attendanceLogs } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { parseForm, zDate, zTime } from "@/lib/form";
import { atBkk } from "@/lib/time";
import { withMsg } from "@/lib/util";

/** HR บันทึกเวลาแทนพนักงาน (เช่น มือถือเสีย) — ต้องระบุเหตุผล และถูกเก็บใน audit log */
export async function addManualPunch(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const P = "/attendance/logs";
  const r = parseForm(
    z.object({ employeeId: z.coerce.number().int(), type: z.enum(["in", "out"]), date: zDate, time: zTime, note: z.string().min(3, "กรุณาระบุเหตุผล") }),
    fd,
  );
  if (!r.ok) redirect(withMsg(P, { error: r.error }));
  const v = r.data;
  const [row] = await db
    .insert(attendanceLogs)
    .values({ employeeId: v.employeeId, type: v.type, punchedAt: atBkk(v.date, v.time), method: "manual", note: v.note, createdBy: u.id })
    .returning({ id: attendanceLogs.id });
  await audit(u.id, "manual_punch", "attendance", row.id, v);
  redirect(withMsg(`${P}?date=${v.date}`, { ok: "บันทึกเวลาแล้ว" }));
}

export async function deletePunch(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id"));
  const back = String(fd.get("back") || "/attendance/logs");
  const [row] = await db.delete(attendanceLogs).where(eq(attendanceLogs.id, id)).returning();
  await audit(u.id, "delete_punch", "attendance", id, row);
  redirect(withMsg(back, { ok: "ลบรายการแล้ว" }));
}
