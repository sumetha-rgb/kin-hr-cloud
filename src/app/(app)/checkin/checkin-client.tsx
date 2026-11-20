"use client";

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
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

/** ชื่อรุ่นมือถือ — Chrome รุ่นใหม่ซ่อนรุ่นใน user agent (เหลือแค่ "K") จึงขอจาก userAgentData แทน */
async function deviceName(): Promise<string> {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) {
    const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues: (h: string[]) => Promise<{ model?: string }> } }).userAgentData;
    const model = await uad?.getHighEntropyValues(["model"]).then((v) => v.model?.trim()).catch(() => undefined);
    const fromUa = ua.match(/Android[^;]*;\s*([^;)]+)/)?.[1]?.trim();
    return model || (fromUa && fromUa !== "K" ? fromUa : "Android");
  }
  return "อุปกรณ์";
}

/** "ทำงานมาแล้ว 3 ชม. 12 นาที" นับจากเวลาเข้างาน HH:MM (เวลาไทย) */
function elapsedSince(hhmm: string, now: Date) {
  const bkk = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const [h, m] = hhmm.split(":").map(Number);
  let mins = bkk.getHours() * 60 + bkk.getMinutes() - (h * 60 + m);
  if (mins < 0) mins += 24 * 60; // เข้างานตั้งแต่เมื่อวาน (กะข้ามวัน)
  return mins < 60 ? `${mins} นาที` : `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
}

export function CheckinClient({
  registered,
  branches,
  allowRemote,
  next,
  inAt,
  doneToday,
}: {
  registered: boolean;
  branches: Branch[];
  allowRemote: boolean;
  /** ขั้นถัดไปที่ทำได้ — ต้องสแกนเข้าก่อนจึงสแกนออกได้ */
  next: "in" | "out";
  /** เวลาเข้างานของกะที่ยังไม่ได้ออก */
  inAt: string | null;
  /** วันนี้เข้า-ออกครบแล้ว */
  doneToday: { in: string; out: string } | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pos, setPos] = useState<Pos | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [again, setAgain] = useState(false); // ลงเวลาครบแล้ว แต่ต้องการเข้างานอีกรอบ

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
      await postJSON("/api/webauthn/register/verify", { response, deviceName: await deviceName() });
      setMsg({ tone: "ok", text: "ลงทะเบียนสำเร็จ ลงเวลาได้เลย" });
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
      setMsg({ tone: "ok", text: `${type === "in" ? "ลงเวลาเข้างาน" : "ลงเวลาออกงาน"}สำเร็จ ${t} น. · ${r.branch ?? "นอกสถานที่"}` });
      setAgain(false);
      router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: explain(e) });
      router.refresh(); // สถานะอาจเปลี่ยนจากเครื่องอื่น/HR บันทึกแทน
    } finally {
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";
  const phaseText = { idle: "", locating: "กำลังหาตำแหน่ง GPS…", scanning: "แตะเซนเซอร์ลายนิ้วมือ / Face ID…", saving: "กำลังบันทึก…" }[phase];
  const isOut = next === "out";
  const showDone = !!doneToday && !isOut && !again;

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* นาฬิกา + ตำแหน่ง */}
      <section className="rounded-3xl border border-brand-200/80 bg-white p-6 text-center shadow-card">
        <p className="text-[15px] text-brand-700">
          {now?.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }) ?? " "}
        </p>
        <p className="mt-1 text-5xl font-semibold tracking-tight text-brand-900 tabular-nums">
          {now?.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" }) ?? "--:--:--"}
        </p>
        <div className="mt-4 flex justify-center">
          {!pos && geoError ? (
            <span className="inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
              <Icon name="pin" className="size-4" />
              {geoError}
              <button type="button" onClick={locate} className="rounded-full bg-white px-3 py-0.5 text-xs font-medium ring-1 ring-amber-300 hover:bg-amber-100">
                ลองใหม่
              </button>
            </span>
          ) : !pos ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm text-stone-500">
              <span className="size-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
              กำลังหาตำแหน่ง…
            </span>
          ) : nearest ? (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", inside ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>
              <Icon name="pin" className="size-4" />
              {inside ? "อยู่ในพื้นที่" : "อยู่นอกพื้นที่"} {nearest.b.name} · {Math.round(nearest.d)} ม.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
              <Icon name="pin" className="size-4" />
              ยังไม่ได้ตั้งพิกัดสาขา
            </span>
          )}
        </div>
        {allowRemote && !inside && pos && <p className="mt-2 text-xs text-brand-700">คุณได้รับสิทธิ์ลงเวลานอกสถานที่</p>}
      </section>

      {supported === false && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Icon name="alert" className="mt-0.5 size-5" />
          <p>อุปกรณ์หรือเบราว์เซอร์นี้สแกนลายนิ้วมือไม่ได้ — ใช้มือถือที่ตั้งลายนิ้วมือหรือ Face ID ไว้ และเปิดผ่าน Safari / Chrome</p>
        </div>
      )}

      {!registered ? (
        /* ยังไม่ลงทะเบียนมือถือ */
        <section className="rounded-3xl border border-brand-200/80 bg-white p-6 text-center shadow-card">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow">
            <Icon name="finger" className="size-9" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-brand-900">ลงทะเบียนลายนิ้วมือ</h2>
          <p className="mt-1 text-sm text-stone-500">ทำครั้งเดียวบนมือถือของคุณเอง ระบบใช้ลายนิ้วมือหรือ Face ID ที่ตั้งไว้ในเครื่อง ข้อมูลไม่ถูกส่งออกจากมือถือ</p>
          <button
            disabled={busy || supported === false}
            onClick={register}
            className="mt-5 min-h-13 w-full rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 py-3.5 text-base font-semibold text-white shadow-md disabled:opacity-50"
          >
            {busy ? phaseText : "ลงทะเบียนมือถือเครื่องนี้"}
          </button>
        </section>
      ) : showDone ? (
        /* วันนี้เข้า-ออกครบแล้ว */
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-card">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
            <Icon name="tick" className="size-7" strokeWidth={2.4} />
          </span>
          <h2 className="mt-3 text-lg font-semibold text-emerald-800">วันนี้ลงเวลาครบแล้ว</h2>
          <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 divide-x divide-emerald-200 rounded-2xl bg-white py-3 ring-1 ring-emerald-100">
            <div>
              <p className="text-xs text-stone-500">เข้างาน</p>
              <p className="text-xl font-semibold text-brand-900 tabular-nums">{doneToday.in}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">ออกงาน</p>
              <p className="text-xl font-semibold text-brand-900 tabular-nums">{doneToday.out}</p>
            </div>
          </div>
          <button type="button" onClick={() => setAgain(true)} className="mt-4 text-sm font-medium text-brand-700 underline-offset-4 hover:underline">
            ต้องการเข้างานอีกรอบ
          </button>
        </section>
      ) : (
        /* ปุ่มหลัก: แสดงเฉพาะขั้นถัดไป */
        <section className="rounded-3xl border border-brand-200/80 bg-white p-6 shadow-card">
          {/* ลำดับขั้น: เข้างาน → ออกงาน */}
          <ol className="mx-auto mb-6 flex max-w-xs items-center text-xs font-medium">
            <li className={cn("flex items-center gap-1.5", isOut ? "text-emerald-700" : "text-brand-900")}>
              <span className={cn("flex size-6 items-center justify-center rounded-full", isOut ? "bg-emerald-500 text-white" : "bg-brand-900 text-white")}>
                {isOut ? <Icon name="tick" className="size-3.5" strokeWidth={3} /> : "1"}
              </span>
              เข้างาน{isOut && inAt ? ` ${inAt}` : ""}
            </li>
            <span className={cn("mx-2 h-px flex-1", isOut ? "bg-emerald-300" : "bg-brand-200")} />
            <li className={cn("flex items-center gap-1.5", isOut ? "text-brand-900" : "text-stone-400")}>
              <span className={cn("flex size-6 items-center justify-center rounded-full", isOut ? "bg-brand-900 text-white" : "bg-brand-100 text-stone-400")}>2</span>
              ออกงาน
            </li>
          </ol>

          <div className="flex flex-col items-center">
            <button
              disabled={busy || supported === false}
              onClick={() => punch(next)}
              aria-label={isOut ? "สแกนออกงาน" : "สแกนเข้างาน"}
              className={cn(
                "group relative flex size-44 flex-col items-center justify-center gap-2 rounded-full text-white shadow-xl transition active:scale-95 disabled:opacity-60",
                isOut ? "bg-gradient-to-br from-rose-500 to-rose-700 shadow-rose-700/30" : "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-700/30",
              )}
            >
              {!busy && <span className={cn("absolute inset-0 animate-ping rounded-full [animation-duration:2.6s]", isOut ? "bg-rose-400/25" : "bg-emerald-400/25")} />}
              <span className="absolute inset-2 rounded-full ring-1 ring-white/25" />
              {busy ? <span className="size-12 animate-spin rounded-full border-4 border-white/30 border-t-white" /> : <Icon name="finger" className="relative size-14" strokeWidth={1.5} />}
              <span className="relative text-lg font-semibold">{isOut ? "สแกนออกงาน" : "สแกนเข้างาน"}</span>
            </button>
            <p className="mt-5 min-h-6 text-center text-[15px] text-brand-700">
              {busy ? (
                <span className="font-medium">{phaseText}</span>
              ) : isOut && inAt && now ? (
                <>
                  เข้างานเมื่อ <b className="tabular-nums">{inAt} น.</b> · ทำงานมาแล้ว {elapsedSince(inAt, now)}
                </>
              ) : (
                "แตะปุ่มแล้วสแกนนิ้วหรือ Face ID เพื่อเข้างาน"
              )}
            </p>
            {again && (
              <button type="button" onClick={() => setAgain(false)} className="mt-1 text-sm text-stone-500 hover:text-brand-800">
                ยกเลิก
              </button>
            )}
          </div>
        </section>
      )}

      {msg && (
        <div
          role={msg.tone === "err" ? "alert" : "status"}
          className={cn(
            "animate-in flex items-start gap-3 rounded-2xl border p-4 text-[15px] font-medium",
            msg.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700",
          )}
        >
          <Icon name={msg.tone === "ok" ? "checkCircle" : "alert"} className="mt-0.5 size-5" />
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
