"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addDays, fmtDate, isoWeekday, monthRange } from "@/lib/time";
import { Icon } from "./icons";
import { cn } from "@/lib/util";

/** สร้าง URL ใหม่โดยคง query เดิมไว้ แล้วเปลี่ยนเฉพาะค่าที่ส่งมา (ค่าว่าง = ลบ) */
function useQueryHref() {
  const path = usePathname();
  const sp = useSearchParams();
  return (patch: Record<string, string | null | undefined>) => {
    const q = new URLSearchParams(sp.toString());
    q.delete("ok");
    q.delete("error");
    for (const [k, v] of Object.entries(patch)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
}

/** แถบตัวกรองด้านบนตาราง: การ์ดขาวโค้งมน เรียงแนวนอน ตัดบรรทัดบนจอเล็ก */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-5 flex flex-wrap items-center gap-2 rounded-3xl border border-brand-200/80 bg-white p-2 shadow-card", className)}>{children}</div>;
}

const arrowCls =
  "flex size-10 shrink-0 items-center justify-center rounded-full text-lg text-brand-700 transition hover:bg-brand-50 active:scale-95 aria-disabled:pointer-events-none aria-disabled:opacity-30";

function Arrow({ href, dir, label }: { href: string | null; dir: "prev" | "next"; label: string }) {
  const icon = (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
  return href ? (
    <Link href={href} className={arrowCls} aria-label={label} scroll={false}>
      {icon}
    </Link>
  ) : (
    <span className={arrowCls} aria-disabled>
      {icon}
    </span>
  );
}

/* ------------------------------ ปฏิทินเลือกช่วงวันที่ ------------------------------ */

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_WD = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const shiftMonth = (y: number, m: number, n: number) => {
  const t = y * 12 + (m - 1) + n;
  return [Math.floor(t / 12), (t % 12) + 1] as const;
};
const dayCount = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;

/** ช่องวันของเดือน (เริ่มวันจันทร์) — null = ช่องว่างก่อนวันที่ 1 */
function monthCells(y: number, m: number): Array<string | null> {
  const first = isoWeekday(ymd(y, m, 1));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [...Array<null>(first - 1).fill(null), ...Array.from({ length: last }, (_, i) => ymd(y, m, i + 1))];
}

function rangeText(from: string, to: string) {
  if (from === to) return fmtDate(from);
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

/**
 * ‹ [ป้ายวันที่/ช่วง → เปิดปฏิทิน] › + ปุ่ม "วันนี้"
 * ปฏิทิน: แตะวันเริ่ม แล้วแตะวันสิ้นสุด (แตะวันเดียวซ้ำ = วันเดียว) หรือเลือกช่วงลัด แล้วโหลดใหม่ทันที
 * URL: วันเดียว → ?date=  ·  ช่วง → ?from=&to=
 */
export function DateRangeNav({
  from,
  to,
  today,
  label,
  sublabel,
  prev,
  next,
  maxDays = 92,
  defaultIsToday = true,
}: {
  from: string;
  to: string;
  today: string;
  label: string;
  sublabel?: string;
  prev: { from: string; to: string };
  next: { from: string; to: string };
  maxDays?: number;
  /** หน้าไม่ระบุวันใน URL = วันนี้ (ตัด ?date= ออกให้ URL สั้น) · false = ใส่ ?date= เสมอ */
  defaultIsToday?: boolean;
}) {
  const href = useQueryHref();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const rangeHref = (a: string, b: string) =>
    a === b ? href({ date: a === today && defaultIsToday ? null : a, from: null, to: null }) : href({ date: null, from: a, to: b });
  const go = (a: string, b: string) => {
    setOpen(false);
    start(() => router.push(rangeHref(a, b), { scroll: false }));
  };

  // ปิดเมื่อแตะนอกกล่อง / กด Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isToday = from === today && to === today;
  return (
    <div ref={boxRef} className="relative flex w-full items-center gap-2 sm:w-auto">
      <div className={cn("flex flex-1 items-center justify-between rounded-full border border-brand-200 bg-brand-50/60 p-0.5 sm:flex-none", pending && "opacity-60")}>
        <Arrow href={rangeHref(prev.from, prev.to)} dir="prev" label="ช่วงก่อนหน้า" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn("flex min-w-40 items-center justify-center gap-2 rounded-full px-3 py-1 leading-tight transition hover:bg-white", open && "bg-white shadow-sm")}
        >
          <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
            <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4" />
          </svg>
          <span className="flex flex-col items-center">
            <span className="text-[15px] font-semibold whitespace-nowrap text-brand-900 sm:text-sm">{label}</span>
            {sublabel && <span className="text-[11px] text-brand-600">{sublabel}</span>}
          </span>
        </button>
        <Arrow href={rangeHref(next.from, next.to)} dir="next" label="ช่วงถัดไป" />
      </div>
      {!isToday && (
        <button type="button" onClick={() => go(today, today)} className="shrink-0 rounded-full border border-brand-200 px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50">
          วันนี้
        </button>
      )}
      {open && <RangeCalendar from={from} to={to} today={today} maxDays={maxDays} onPick={go} />}
    </div>
  );
}

function RangeCalendar({ from, to, today, maxDays, onPick }: { from: string; to: string; today: string; maxDays: number; onPick: (a: string, b: string) => void }) {
  const [view, setView] = useState(() => [Number(to.slice(0, 4)), Number(to.slice(5, 7))] as const);
  const [anchor, setAnchor] = useState<string | null>(null); // วันเริ่มที่แตะแล้ว รอวันสิ้นสุด
  const [hover, setHover] = useState<string | null>(null);

  const [y, m] = view;
  const cells = monthCells(y, m);
  // ช่วงที่ไฮไลต์: ระหว่างเลือก = anchor→hover, ไม่ได้เลือก = ช่วงปัจจุบัน
  const [a, b] = anchor ? [anchor, hover ?? anchor].sort() : [from, to];

  const thisMonth = monthRange(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const [ly, lm] = shiftMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)), -1);
  const lastMonth = monthRange(ly, lm);
  const presets: Array<[string, string, string]> = [
    ["วันนี้", today, today],
    ["เมื่อวาน", addDays(today, -1), addDays(today, -1)],
    ["7 วันล่าสุด", addDays(today, -6), today],
    ["30 วันล่าสุด", addDays(today, -29), today],
    ["เดือนนี้", thisMonth.start, today],
    ["เดือนที่แล้ว", lastMonth.start, lastMonth.end],
  ];

  function pick(d: string) {
    if (!anchor) return setAnchor(d);
    const [s, e] = [anchor, d].sort();
    onPick(s, dayCount(s, e) > maxDays ? addDays(s, maxDays - 1) : e);
  }

  return (
    <div
      role="dialog"
      aria-label="เลือกช่วงวันที่"
      className="animate-in absolute top-full left-0 z-40 mt-2 w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-brand-200 bg-white shadow-lift sm:flex"
    >
      {/* ช่วงลัด */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-brand-100 bg-brand-50/50 p-3 sm:w-40 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
        {presets.map(([t, s, e]) => {
          const active = s === from && e === to && !anchor;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onPick(s, e)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-left text-sm whitespace-nowrap transition sm:rounded-xl",
                active ? "bg-brand-900 font-medium text-white" : "text-brand-800 hover:bg-white",
              )}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* ปฏิทิน */}
      <div className="flex-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setView(shiftMonth(y, m, -1))} className="flex size-9 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50" aria-label="เดือนก่อน">
            <Icon name="chevronLeft" className="size-5" />
          </button>
          <span className="font-semibold text-brand-900">
            {TH_MONTHS[m - 1]} {y + 543}
          </span>
          <button type="button" onClick={() => setView(shiftMonth(y, m, 1))} className="flex size-9 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50" aria-label="เดือนถัดไป">
            <Icon name="chevronRight" className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-stone-400">
          {TH_WD.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover(null)}>
          {cells.map((d, i) => {
            if (!d) return <span key={`x${i}`} />;
            const inRange = d >= a && d <= b;
            const isEdge = d === a || d === b;
            const weekend = isoWeekday(d) >= 6;
            return (
              <span key={d} className={cn("flex justify-center", inRange && "bg-brand-100", d === a && "rounded-l-full", d === b && "rounded-r-full")}>
                <button
                  type="button"
                  onClick={() => pick(d)}
                  onMouseEnter={() => anchor && setHover(d)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition",
                    isEdge ? "bg-brand-600 font-semibold text-white shadow-sm" : inRange ? "text-brand-900" : weekend ? "text-stone-400 hover:bg-brand-50" : "text-brand-900 hover:bg-brand-50",
                    d === today && !isEdge && "ring-1 ring-brand-400",
                  )}
                >
                  {Number(d.slice(8))}
                </button>
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-brand-100 pt-3 text-sm">
          <span className="text-stone-500">{anchor ? "แตะวันสิ้นสุด (แตะวันเดิมซ้ำ = วันเดียว)" : rangeText(from, to)}</span>
          {anchor && (
            <button type="button" onClick={() => setAnchor(null)} className="rounded-full px-3 py-1 text-brand-700 hover:bg-brand-50">
              ยกเลิก
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** ‹ ป้าย › สำหรับเลื่อนเดือน/ปี (ลิงก์ล้วน) */
export function StepNav({ label, prev, next }: { label: React.ReactNode; prev: string | null; next: string | null }) {
  return (
    <div className="flex w-full items-center justify-between rounded-full border border-brand-200 bg-brand-50/60 p-0.5 sm:w-auto">
      <Arrow href={prev} dir="prev" label="ก่อนหน้า" />
      <span className="min-w-32 px-3 text-center text-[15px] font-semibold whitespace-nowrap text-brand-900 sm:text-sm">{label}</span>
      <Arrow href={next} dir="next" label="ถัดไป" />
    </div>
  );
}

/**
 * ช่องเลือกที่เปลี่ยนแล้วกรองทันที (เก็บค่าใน URL)
 * label = หัวข้อสั้น ๆ ที่แสดงในแคปซูลตลอด เช่น "สาขา" → "สาขา  ทั้งหมด ▾" / "สาขา  KIN พัทยา ✕"
 */
export function FilterSelect({
  param,
  value,
  options,
  placeholder = "ทั้งหมด",
  label,
  icon,
  className,
}: {
  param: string;
  value: string;
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const href = useQueryHref();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const set = (v: string) => {
    setOpen(false);
    start(() => router.push(href({ [param]: v || null }), { scroll: false }));
  };
  const active = value !== "";
  const all = [{ value: "", label: placeholder }, ...options.map((o) => ({ value: String(o.value), label: o.label }))];
  const current = all.find((o) => o.value === value) ?? all[0];

  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, all.findIndex((o) => o.value === value)));
    const onDown = (e: MouseEvent | TouchEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setHi((h) => Math.min(all.length - 1, Math.max(0, h + (e.key === "ArrowDown" ? 1 : -1))));
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      set(all[hi].value);
    }
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-full border py-2 pr-10 text-left transition outline-none focus-visible:ring-4 focus-visible:ring-brand-100 sm:min-h-10",
          active ? "border-brand-400 bg-brand-50" : "border-brand-200 bg-white hover:border-brand-300",
          icon || label ? "pl-4" : "pl-4",
          active && "pr-16",
          pending && "opacity-60",
        )}
      >
        {icon && <span className="text-brand-500">{icon}</span>}
        {label && <span className={cn("shrink-0 text-xs font-medium whitespace-nowrap", active ? "text-brand-700" : "text-stone-500")}>{label}</span>}
        {label && <span className={cn("h-3.5 w-px shrink-0", active ? "bg-brand-300" : "bg-brand-200")} aria-hidden />}
        <span className={cn("min-w-0 flex-1 truncate text-[15px] sm:text-sm", active ? "font-medium text-brand-900" : "text-brand-900")}>{current.label}</span>
      </button>
      {active && (
        <button type="button" onClick={() => set("")} className="absolute top-1/2 right-8 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-brand-600 hover:bg-white hover:text-rose-600" aria-label={`ล้างตัวกรอง${label ?? ""}`}>
          <Icon name="x" className="size-3.5" />
        </button>
      )}
      <svg viewBox="0 0 24 24" className={cn("pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-brand-500 transition", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <path d="M6 9l6 6 6-6" />
      </svg>

      {open && (
        <ul role="listbox" aria-label={label} className="animate-in absolute top-full left-0 z-30 mt-1.5 max-h-80 w-full min-w-56 overflow-y-auto rounded-2xl border border-brand-200 bg-white p-1.5 shadow-lift">
          {all.map((o, i) => {
            const sel = o.value === value;
            return (
              <li key={o.value || "__all"} role="option" aria-selected={sel}>
                <button
                  type="button"
                  onMouseEnter={() => setHi(i)}
                  onClick={() => set(o.value)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] leading-snug sm:text-sm",
                    i === hi ? "bg-brand-50" : "",
                    sel ? "font-semibold text-brand-900" : "text-stone-700",
                    o.value === "" && "text-stone-500",
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center text-brand-600">{sel && <Icon name="tick" className="size-4" strokeWidth={2.4} />}</span>
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
