import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { webauthnCredentials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { setChallenge } from "@/lib/session";
import { getRp } from "@/lib/webauthn";

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.employeeId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบด้วยบัญชีพนักงาน" }, { status: 401 });

  const creds = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id));
  if (!creds.length) return NextResponse.json({ error: "ยังไม่ได้ลงทะเบียนลายนิ้วมือ", needRegister: true }, { status: 400 });

  const { rpID } = await getRp();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports ?? undefined })),
    timeout: 60_000,
  });
  await setChallenge({ challenge: options.challenge, uid: user.id, purpose: "punch" });
  return NextResponse.json(options);
}
