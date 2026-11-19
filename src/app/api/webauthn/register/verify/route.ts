import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { webauthnCredentials } from "@/db/schema";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { takeChallenge } from "@/lib/session";
import { getRp, toB64url } from "@/lib/webauthn";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { response?: RegistrationResponseJSON; deviceName?: string } | null;
  if (!body?.response) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const challenge = await takeChallenge("register", user.id);
  if (!challenge) return NextResponse.json({ error: "หมดเวลา กรุณาลองใหม่" }, { status: 400 });

  const existing = await db.select({ id: webauthnCredentials.id }).from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id));
  if (existing.length > 0) return NextResponse.json({ error: "บัญชีนี้ลงทะเบียนอุปกรณ์ไว้แล้ว" }, { status: 409 });

  const { rpID, origin } = await getRp();
  try {
    const v = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!v.verified) return NextResponse.json({ error: "ยืนยันตัวตนไม่สำเร็จ" }, { status: 400 });
    const { credential } = v.registrationInfo;
    await db.insert(webauthnCredentials).values({
      id: credential.id,
      userId: user.id,
      publicKey: toB64url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? null,
      deviceName: (body.deviceName || "มือถือ").slice(0, 100),
    });
    await audit(user.id, "register_device", "user", user.id, { deviceName: body.deviceName });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "ยืนยันไม่สำเร็จ: " + (e as Error).message }, { status: 400 });
  }
}
