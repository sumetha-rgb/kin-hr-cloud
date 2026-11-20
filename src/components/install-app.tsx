"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/util";
import { Icon } from "./icons";

type Platform = "ios" | "android";
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function detect() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const inApp = /Line\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(ua); // เปิดจากในแอปแชท/โซเชียล ติดตั้งไม่ได้
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { ios, android, inApp, standalone };
}

const ICON = {
  share: "M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
  plus: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM12 8v8M8 12h8",
  dots: "M12 5h.01M12 12h.01M12 19h.01",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  check: "M5 12l5 5 9-11",
};

function Glyph({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("inline size-[18px] align-[-3px]", className)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const STEPS: Record<Platform, Array<{ t: React.ReactNode; d?: React.ReactNode }>> = {
  ios: [
    { t: "เปิดเว็บนี้ด้วย Safari", d: "ถ้าเปิดจาก LINE / Facebook ให้กด ••• แล้วเลือก “เปิดใน Safari” ก่อน" },
    {
      t: (
        <>
          แตะปุ่ม <b>แชร์</b> <Glyph d={ICON.share} className="text-sky-600" />
        </>
      ),
      d: "อยู่แถบล่างของ Safari (iOS รุ่นใหม่: แตะ ••• ก่อน แล้วเลือก “แชร์”)",
    },
    {
      t: (
        <>
          เลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b> <Glyph d={ICON.plus} />
        </>
      ),
      d: "ถ้าไม่เห็น ให้เลื่อนรายการลงด้านล่าง",
    },
    { t: (<>แตะ <b>“เพิ่ม”</b> มุมขวาบน</>), d: "ถ้ามีตัวเลือก “เปิดเป็นเว็บแอป” ให้เปิดไว้" },
    { t: "เปิดแอป KIN HR จากหน้าจอโฮม", d: "เข้าสู่ระบบอีกครั้ง 1 ครั้ง แล้วใช้ Face ID / Touch ID ลงเวลาได้เลย" },
  ],
  android: [
    { t: "เปิดเว็บนี้ด้วย Chrome", d: "ถ้าเปิดจาก LINE / Facebook ให้กด ⋮ แล้วเลือก “เปิดใน Chrome” ก่อน" },
    {
      t: (
        <>
          แตะเมนู <Glyph d={ICON.dots} /> มุมขวาบน
        </>
      ),
    },
    {
      t: (
        <>
          เลือก <b>“ติดตั้งแอป”</b> หรือ <b>“เพิ่มลงในหน้าจอหลัก”</b> <Glyph d={ICON.download} />
        </>
      ),
    },
    { t: (<>แตะ <b>“ติดตั้ง”</b></>), d: "ไอคอน KIN HR จะอยู่บนหน้าจอหลักและในรายการแอป" },
    { t: "เปิดแอป KIN HR แล้วลงเวลาด้วยลายนิ้วมือได้เลย" },
  ],
};

/** ปุ่ม "ติดตั้งแอป" + วิธีติดตั้ง iPhone / Android (Android+Chrome กดติดตั้งได้ทันที) */
export function InstallApp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Platform>("ios");
  const [env, setEnv] = useState<ReturnType<typeof detect> | null>(null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const e = detect();
    setEnv(e);
    if (e.android) setTab("android");
    const onPrompt = (ev: Event) => {
      ev.preventDefault();
      setPrompt(ev as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (env?.standalone) return null; // เปิดจากแอปที่ติดตั้งแล้ว ไม่ต้องแสดง

  async function installNow() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-300 hover:bg-brand-50/60",
          className,
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-sm">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 7v7M9 11l3 3 3-3M11 19h2" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-semibold text-brand-900">ติดตั้งแอป KIN HR บนมือถือ</span>
          <span className="block text-xs text-stone-500">เปิดลงเวลาได้จากหน้าจอโฮม เหมือนแอปทั่วไป · iPhone / Android</span>
        </span>
        <Icon name="chevronRight" className="size-5 text-brand-400" />
      </button>

      {/* portal ไปที่ body — ถ้าอยู่ใต้กล่องที่มี animation/transform, position:fixed จะไม่เต็มจอ */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/45 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="วิธีติดตั้งแอป"
            onClick={(e) => e.stopPropagation()}
            className="animate-in max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lift sm:max-w-md sm:rounded-[28px]"
          >
            <div className="sticky top-0 z-10 bg-white/95 px-5 pt-3 pb-3 backdrop-blur">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-brand-200 sm:hidden" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-brand-900">ติดตั้งแอปบนมือถือ</h2>
                <button type="button" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50" aria-label="ปิด">
                  <Icon name="x" className="size-5" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-brand-50 p-1 ring-1 ring-brand-100">
                {(
                  [
                    ["ios", "iPhone / iPad"],
                    ["android", "Android"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={cn("rounded-full py-2 text-sm font-medium transition", tab === k ? "bg-white text-brand-900 shadow-sm" : "text-stone-500 hover:text-brand-800")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5">
              {env?.inApp && (
                <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  ตอนนี้เปิดจากในแอปแชท/โซเชียล ซึ่งติดตั้งไม่ได้ — กรุณาเปิดลิงก์นี้ใน {tab === "ios" ? "Safari" : "Chrome"} ก่อน
                </p>
              )}

              {tab === "android" && (installed || prompt) && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                  {installed ? (
                    <p className="font-medium text-emerald-700">
                      <Glyph d={ICON.check} /> ติดตั้งแล้ว — เปิดแอป KIN HR จากหน้าจอหลักได้เลย
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-emerald-800">เครื่องนี้ติดตั้งได้ทันที</p>
                      <button type="button" onClick={installNow} className="mt-2 w-full rounded-full bg-emerald-600 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-700">
                        <Glyph d={ICON.download} /> ติดตั้งเลย
                      </button>
                      <p className="mt-2 text-xs text-emerald-700">หรือทำตามขั้นตอนด้านล่าง</p>
                    </>
                  )}
                </div>
              )}

              <ol className="space-y-3">
                {STEPS[tab].map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
                    <span className="pt-0.5 leading-snug">
                      <span className="block text-[15px] text-brand-900">{s.t}</span>
                      {s.d && <span className="mt-0.5 block text-sm text-stone-500">{s.d}</span>}
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-5 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800 ring-1 ring-brand-100">
                <b>หมายเหตุ</b>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-brand-700">
                  <li>ไม่ต้องโหลดจาก App Store / Play Store และไม่กินพื้นที่เครื่อง</li>
                  <li>เปิดแอปครั้งแรกให้กด “อนุญาต” ตำแหน่ง (GPS) เพื่อใช้ลงเวลา</li>
                  {tab === "ios" && <li>บน iPhone ต้องติดตั้งผ่าน Safari เท่านั้นจึงจะได้ผลดีที่สุด</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
