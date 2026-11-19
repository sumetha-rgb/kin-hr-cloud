import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "hr_session";
const CHALLENGE_COOKIE = "hr_wa";
const isProd = process.env.NODE_ENV === "production";

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

async function sign(payload: JWTPayload, exp: string) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(key());
}

async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as T;
  } catch {
    return null;
  }
}

/* --------------------------------- Session -------------------------------- */
export async function createSession(uid: number) {
  const token = await sign({ uid }, "30d");
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function readSession(): Promise<{ uid: number } | null> {
  return verify<{ uid: number }>((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

/* ------------------------ WebAuthn challenge (5 นาที) ----------------------- */
type ChallengePayload = { challenge: string; uid: number; purpose: "register" | "punch" };

export async function setChallenge(p: ChallengePayload) {
  const token = await sign(p, "5m");
  (await cookies()).set(CHALLENGE_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: 300 });
}

/** อ่านแล้วลบทิ้งทันที (ใช้ได้ครั้งเดียว) */
export async function takeChallenge(purpose: ChallengePayload["purpose"], uid: number): Promise<string | null> {
  const jar = await cookies();
  const p = await verify<ChallengePayload>(jar.get(CHALLENGE_COOKIE)?.value);
  jar.delete(CHALLENGE_COOKIE);
  if (!p || p.purpose !== purpose || p.uid !== uid) return null;
  return p.challenge;
}
