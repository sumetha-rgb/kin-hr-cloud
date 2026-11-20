import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { attendanceLogs, branches, employees, webauthnCredentials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { nearestBranch } from "@/lib/geo";
import { getSettings } from "@/lib/payroll-run";
import { lastRecentPunch, nextPunchType } from "@/lib/punch";
import { takeChallenge } from "@/lib/session";
import { fromB64url, getRp } from "@/lib/webauthn";

const bodySchema = z.object({
  response: z.custom<AuthenticationResponseJSON>((v) => typeof v === "object" && v !== null && "id" in v),
  type: z.enum(["in", "out"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0),
});

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.employeeId) return err("กรุณาเข้าสู่ระบบด้วยบัญชีพนักงาน", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err("ข้อมูลไม่ครบ (ต้องเปิด GPS)");
  const b = parsed.data;

  // 0) ลำดับต้องถูก: ต้องสแกนเข้างานก่อนจึงสแกนออกได้ และสแกนเข้าซ้ำระหว่างยังไม่ออกไม่ได้
  const expected = nextPunchType(await lastRecentPunch(user.employeeId));
  if (b.type !== expected) {
    return err(b.type === "out" ? "ยังไม่ได้สแกนเข้างาน — กรุณาสแกนเข้างานก่อน" : "คุณสแกนเข้างานแล้ว — ครั้งถัดไปให้สแกนออกงาน", 409);
  }

  // 1) ยืนยันลายนิ้วมือ (WebAuthn, userVerification = required)
  const challenge = await takeChallenge("punch", user.id);
  if (!challenge) return err("หมดเวลา กรุณาสแกนใหม่");
  const [cred] = await db
    .select()
    .from(webauthnCredentials)
    .where(and(eq(webauthnCredentials.id, b.response.id), eq(webauthnCredentials.userId, user.id)));
  if (!cred) return err("อุปกรณ์นี้ไม่ได้ลงทะเบียนไว้กับบัญชีของคุณ", 403);

  const { rpID, origin } = await getRp();
  let newCounter = cred.counter;
  try {
    const v = await verifyAuthenticationResponse({
      response: b.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: cred.id, publicKey: fromB64url(cred.publicKey), counter: cred.counter, transports: cred.transports ?? undefined },
    });
    if (!v.verified) return err("ยืนยันลายนิ้วมือไม่สำเร็จ", 403);
    newCounter = v.authenticationInfo.newCounter;
  } catch (e) {
    return err("ยืนยันลายนิ้วมือไม่สำเร็จ: " + (e as Error).message, 403);
  }

  // 2) ตรวจตำแหน่ง (geofence)
  const [settings, [emp], activeBranches] = await Promise.all([
    getSettings(),
    db.select().from(employees).where(eq(employees.id, user.employeeId)),
    db.select().from(branches).where(eq(branches.active, true)),
  ]);
  if (!emp) return err("ไม่พบข้อมูลพนักงาน", 404);
  if (b.accuracy > settings.maxGpsAccuracyM) {
    return err(`GPS ยังไม่แม่นยำพอ (±${Math.round(b.accuracy)} ม.) ลองออกไปที่โล่งหรือเปิด Wi-Fi แล้วลองใหม่`);
  }
  const near = nearestBranch(b.latitude, b.longitude, activeBranches);
  const inside = near && near.distance <= near.branch.radiusM;
  if (!inside && !emp.allowRemoteCheckin) {
    if (!near) return err("ยังไม่ได้ตั้งพิกัดสาขา กรุณาแจ้ง HR");
    return err(`คุณอยู่นอกพื้นที่ลงเวลา (ห่าง ${near.branch.name} ${Math.round(near.distance)} ม. / อนุญาต ${near.branch.radiusM} ม.)`, 403);
  }

  // 3) กันกดซ้ำภายใน 2 นาที
  const [last] = await db
    .select()
    .from(attendanceLogs)
    .where(and(eq(attendanceLogs.employeeId, emp.id), gte(attendanceLogs.punchedAt, new Date(Date.now() - 2 * 60_000))))
    .orderBy(desc(attendanceLogs.punchedAt))
    .limit(1);
  if (last && last.type === b.type) return err("ลงเวลาไปแล้วเมื่อสักครู่");

  const now = new Date();
  await Promise.all([
    db.insert(attendanceLogs).values({
      employeeId: emp.id,
      type: b.type,
      punchedAt: now,
      method: "biometric",
      branchId: inside ? near!.branch.id : null,
      latitude: b.latitude,
      longitude: b.longitude,
      accuracyM: b.accuracy,
      distanceM: near?.distance ?? null,
      credentialId: cred.id,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      note: inside ? null : "ลงเวลานอกสถานที่",
    }),
    db.update(webauthnCredentials).set({ counter: newCounter, lastUsedAt: now }).where(eq(webauthnCredentials.id, cred.id)),
  ]);

  return NextResponse.json({
    ok: true,
    type: b.type,
    punchedAt: now.toISOString(),
    branch: inside ? near!.branch.name : null,
    distance: near ? Math.round(near.distance) : null,
    remote: !inside,
  });
}
