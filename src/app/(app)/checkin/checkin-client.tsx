"use client";

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/util";

type Branch = { id: number; name: string; latitude: number | null; longitude: number | null; radiusM: number };
type Pos = { latitude: number; longitude: number; accuracy: number };
type Phase = "idle" | "locating" | "scanning" | "saving";

function distance(a: Pos, b: Branch) {
  if (b.latitude == null || b.longitude == null) return Infinity;
  const R = 6371000,
    r = (d: number) => (d * Math.PI) / 180;
  const x = Math.sin(r(b.latitude - a.latitude) / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function getPosition(): Promise<Pos> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("อุปกรณ์นี้ไม่รองรับ GPS"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED ? "กรุณาอนุญาตการเข้าถึงตำแหน่ง (Location) ในการตั้งค่าเบราว์เซอร์" : e.code === e.TIMEOUT ? "หาตำแหน่งไม่ทัน ลองใหม่อีกครั้ง" : e.message,
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

function explain(e: unknown): string {
  if (e instanceof WebAuthnError) {
    if (e.code === "ERROR_CEREMONY_ABORTED") return "ยกเลิกการสแกน";
    if (e.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return "มือถือเครื่องนี้ลงทะเบียนไว้แล้ว";
    if (e.code === "ERROR_INVALID_DOMAIN") return "ต้องเปิดผ่าน HTTPS เท่านั้นจึงจะสแกนนิ้วได้";
  }
  if (e instanceof Error && e.name === "NotAllowedError") return "ยกเลิกหรือหมดเวลาการสแกน";
  return e instanceof Error ? e.message : String(e);
}

async function postJSON(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "เกิดข้อผิดพลาด"), { data });
  return data;
}

export function CheckinClient({
  registered,
  branches,
  allowRemote,
  suggested,
}: {
  registered: boolean;
  branches: Branch[];
  allowRemote: boolean;
  suggested: "in" | "out";
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pos, setPos] = useState<Pos | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  function locate() {
    setGeoError(null);
    getPosition()
      .then(setPos)
      .catch((e: Error) => setGeoError(e.message));
  }

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    (async () => setSupported(browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable())))();
    locate();
    return () => clearInterval(t);
  }, []);

  const nearest = pos
    ? branches.map((b) => ({ b, d: distance(pos, b) })).filter((x) => isFinite(x.d)).sort((a, z) => a.d - z.d)[0]
    : undefined;
  const inside = nearest ? nearest.d <= nearest.b.radiusM : false;

  async function register() {
    setMsg(null);
    try {
      setPhase("scanning");
      const options = await postJSON("/api/webauthn/register/options");
      const response = await startRegistration({ optionsJSON: options });
      setPhase("saving");
      const ua = navigator.userAgent;
      const deviceName = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? (ua.match(/Android[^;]*;\s*([^;)]+)/)?.[1] ?? "Android") : "อุปกรณ์";
      await postJSON("/api/webauthn/register/verify", { response, deviceName });
      setMsg({ tone: "ok", text: "ลงทะเบียนลายนิ้วมือสำเร็จ ✅ ลงเวลาได้เลย" });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: explain(e) });
    } finally {
      setPhase("idle");
    }
  }

  async function punch(type: "in" | "out") {
    setMsg(null);
    try {
      setPhase("locating");
      const p = await getPosition();
      setPos(p);
      setPhase("scanning");
      const options = await postJSON("/api/attendance/options");
      const response = await startAuthentication({ optionsJSON: options });
      setPhase("saving");
      const r = await postJSON("/api/attendance/punch", { response, type, ...p });
      const t = new Date(r.punchedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
      setMsg({ tone: "ok", text: `${type === "in" ? "ลงเวลาเข้า" : "ลงเวลาออก"}สำเร็จ ${t} น. ${r.branch ? `· ${r.branch}` : "· นอกสถานที่"}` });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: explain(e) });
    } finally {
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";
  const phaseText = { idle: "", locating: "กำลังหาตำแหน่ง GPS…", scanning: "แตะเซนเซอร์ลายนิ้วมือ…", saving: "กำลังบันทึก…" }[phase];

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-3xl border border-brand-200 bg-gradient-to-b from-white to-brand-50 p-6 text-center shadow-[0_8px_30px_rgba(120,89,58,0.08)]">
        <div className="text-[15px] text-brand-700">
          {now?.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }) ?? " "}
        </div>
        <div className="mt-1 text-5xl font-semibold text-brand-900 tabular-nums">
          {now?.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" }) ?? "--:--:--"}
        </div>
        <div className="mt-3 text-[15px]">
          {!pos && geoError ? (
            <span className="text-amber-800">
              📍 {geoError}{" "}
              <button type="button" onClick={locate} className="ml-1 rounded-full border border-amber-300 px-3 py-0.5 text-sm">
                ลองใหม่
              </button>
            </span>
          ) : !pos ? (
            <span className="text-stone-500">📍 กำลังหาตำแหน่ง…</span>
          ) : nearest ? (
            <span className={cn("inline-block rounded-full px-3 py-1", inside ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>
              📍 {inside ? "อยู่ในพื้นที่" : "อยู่นอกพื้นที่"} {nearest.b.name} ({Math.round(nearest.d)} ม.) · GPS ±{Math.round(pos.accuracy)} ม.
            </span>
          ) : (
            <span className="text-amber-800">📍 ยังไม่ได้ตั้งพิกัดสาขา</span>
          )}
          {allowRemote && !inside && pos && <div className="mt-1 text-xs text-brand-700">(คุณได้รับสิทธิ์ลงเวลานอกสถานที่)</div>}
        </div>
      </div>

      {supported === false && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการสแกนลายนิ้วมือ — ใช้มือถือที่ตั้งค่าลายนิ้วมือ (หรือ Face ID) ไว้แล้ว และเปิดผ่าน Safari / Chrome ที่ลิงก์ https
        </div>
      )}

      {!registered ? (
        <div className="mt-5 rounded-3xl border border-brand-200 bg-white p-5 text-center">
          <div className="text-4xl">👆</div>
          <h2 className="mt-2 font-semibold">ลงทะเบียนลายนิ้วมือ</h2>
          <p className="mt-1 text-sm text-stone-500">ทำครั้งเดียวบนมือถือของคุณเอง ระบบใช้ลายนิ้วมือที่ตั้งไว้ในเครื่อง และไม่มีข้อมูลลายนิ้วมือถูกส่งขึ้นเซิร์ฟเวอร์</p>
          <button disabled={busy || supported === false} onClick={register} className="mt-4 min-h-13 w-full rounded-2xl bg-brand-600 py-3.5 text-base font-medium text-white disabled:opacity-50">
            {busy ? phaseText : "ลงทะเบียนมือถือเครื่องนี้"}
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {(["in", "out"] as const).map((t) => (
            <button
              key={t}
              disabled={busy || supported === false}
              onClick={() => punch(t)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-3xl py-7 text-lg font-semibold text-white shadow-md transition active:scale-95 disabled:opacity-50",
                t === "in" ? "bg-emerald-600" : "bg-rose-600",
                suggested === t && "ring-4 ring-offset-2 " + (t === "in" ? "ring-emerald-200" : "ring-rose-200"),
              )}
            >
              <svg viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                <path d="M12 11v6m-4-4c0-2.2 1.8-4 4-4s4 1.8 4 4v1m-12-1a8 8 0 0 1 16 0v2M7 19a10 10 0 0 0 1-4" />
              </svg>
              {t === "in" ? "สแกนเข้างาน" : "สแกนออกงาน"}
            </button>
          ))}
        </div>
      )}

      {busy && registered && <p className="mt-3 text-center text-base font-medium text-brand-700">{phaseText}</p>}
      {msg && (
        <div
          className={cn(
            "mt-4 rounded-2xl border p-4 text-center text-[15px] font-medium",
            msg.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : msg.tone === "err" ? "border-rose-200 bg-rose-50 text-rose-700" : "bg-stone-50",
          )}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
