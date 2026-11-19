import { generateRegistrationOptions } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { webauthnCredentials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { setChallenge } from "@/lib/session";
import { getRp } from "@/lib/webauthn";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: "บัญชีนี้ไม่ได้ผูกกับพนักงาน" }, { status: 400 });

  const existing = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id));
  // 1 คน 1 เครื่อง — กันการลงทะเบียนนิ้วคนอื่นบนเครื่องอื่นเพิ่มเอง (ต้องให้ HR รีเซ็ตก่อน)
  if (existing.length > 0) {
    return NextResponse.json({ error: "บัญชีนี้ลงทะเบียนอุปกรณ์ไว้แล้ว หากเปลี่ยนมือถือให้ติดต่อ HR เพื่อรีเซ็ต" }, { status: 409 });
  }

  const { rpID, rpName } = await getRp();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    userDisplayName: user.displayName,
    userID: new TextEncoder().encode(`user-${user.id}`),
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform", // ใช้เซนเซอร์ในตัวมือถือ (ลายนิ้วมือ/ใบหน้า)
      residentKey: "preferred",
      userVerification: "required",
    },
    timeout: 60_000,
  });
  await setChallenge({ challenge: options.challenge, uid: user.id, purpose: "register" });
  return NextResponse.json(options);
}
