"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/util";
import { Icon } from "./icons";

type State = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** เปิด/ปิด "แจ้งเตือนเด้ง" บนเครื่องนี้ — iPhone ต้องติดตั้งแอปบนหน้าจอโฮมก่อน */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "needs-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await fetch("/api/push").then((r) => r.json());
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
      const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "บันทึกไม่สำเร็จ");
      setState("on");
      setMsg("เปิดการแจ้งเตือนแล้ว");
    } catch (e) {
      setMsg("เปิดไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ test: true }) });
    setBusy(false);
    setMsg("ส่งข้อความทดสอบแล้ว — ควรเด้งขึ้นภายในไม่กี่วินาที");
  }

  if (state === "loading") return null;

  const info: Record<Exclude<State, "loading">, { tone: string; icon: "info" | "alert" | "checkCircle"; text: string }> = {
    unsupported: { tone: "bg-stone-50 text-stone-600 ring-stone-200", icon: "info", text: "เบราว์เซอร์นี้รับแจ้งเตือนเด้งไม่ได้ — ยังดูการแจ้งเตือนได้ที่กระดิ่งในระบบ" },
    "needs-install": { tone: "bg-amber-50 text-amber-800 ring-amber-200", icon: "info", text: "บน iPhone ต้องติดตั้งแอป KIN HR บนหน้าจอโฮมก่อน (Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม) แล้วเปิดจากไอคอนแอปจึงจะเปิดแจ้งเตือนได้" },
    denied: { tone: "bg-rose-50 text-rose-700 ring-rose-200", icon: "alert", text: "เครื่องนี้ปิดการแจ้งเตือนของ KIN HR ไว้ — เปิดได้ที่การตั้งค่าของเบราว์เซอร์/มือถือ แล้วกลับมาที่หน้านี้" },
    off: { tone: "bg-brand-50 text-brand-800 ring-brand-200", icon: "info", text: "เปิดเพื่อรับแจ้งเตือนเด้งบนเครื่องนี้ เช่น สลิปเงินเดือนออก ใบลาได้รับอนุมัติ" },
    on: { tone: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: "checkCircle", text: "เครื่องนี้รับแจ้งเตือนเด้งอยู่" },
  };
  const s = info[state];

  return (
    <div className={cn("rounded-2xl p-4 ring-1", s.tone, compact && "p-3")}>
      <div className="flex items-start gap-3">
        <Icon name={s.icon} className="mt-0.5 size-5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">{s.text}</p>
          {msg && <p className="mt-1 text-xs font-medium">{msg}</p>}
        </div>
      </div>
      {(state === "off" || state === "on") && (
        <div className="mt-3 flex flex-wrap gap-2 pl-8">
          {state === "off" ? (
            <button type="button" disabled={busy} onClick={enable} className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50">
              {busy ? "กำลังเปิด…" : "เปิดการแจ้งเตือน"}
            </button>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={test} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100 disabled:opacity-50">
                ส่งข้อความทดสอบ
              </button>
              <button type="button" disabled={busy} onClick={disable} className="rounded-full px-3 py-2 text-sm text-stone-500 hover:text-rose-700 disabled:opacity-50">
                ปิดบนเครื่องนี้
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
