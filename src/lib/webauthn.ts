import { headers } from "next/headers";

/**
 * RP ID = โดเมนที่ผูกกับลายนิ้วมือ ถ้าเปลี่ยนโดเมน พนักงานต้องลงทะเบียนใหม่
 * ถ้าไม่ตั้ง env จะใช้โดเมนจาก request (สะดวกตอนทดสอบผ่าน tunnel) — บน production ควรตั้งค่าให้ตายตัว
 */
export async function getRp() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0];
  const proto = h.get("x-forwarded-proto") ?? (hostname === "localhost" ? "http" : "https");
  return {
    rpID: process.env.WEBAUTHN_RP_ID || hostname,
    origin: process.env.APP_ORIGIN || `${proto}://${host}`,
    rpName: process.env.WEBAUTHN_RP_NAME || "HR Cloud",
  };
}

export const toB64url = (u: Uint8Array) => Buffer.from(u).toString("base64url");
export const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));
