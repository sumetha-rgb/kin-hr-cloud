"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
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

/** ‹ [ป้ายวันที่ กดเพื่อเปิดปฏิทิน] › + ปุ่ม "วันนี้" — เปลี่ยนวันแล้วโหลดใหม่ทันที ไม่ต้องกด "แสดง" */
export function DateNav({
  date,
  today,
  label,
  sublabel,
  param = "date",
  prev,
  next,
}: {
  date: string;
  today: string;
  label: string;
  sublabel?: string;
  param?: string;
  prev: string;
  next: string;
}) {
  const href = useQueryHref();
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (d: string) => start(() => router.push(href({ [param]: d === today ? null : d }), { scroll: false }));
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <div className={cn("flex flex-1 items-center justify-between rounded-full border border-brand-200 bg-brand-50/60 p-0.5 sm:flex-none", pending && "opacity-60")}>
        <Arrow href={href({ [param]: prev === today ? null : prev })} dir="prev" label="วันก่อนหน้า" />
        <label className="relative flex min-w-36 cursor-pointer flex-col items-center rounded-full px-3 py-1 leading-tight hover:bg-white">
          <span className="text-[15px] font-semibold whitespace-nowrap text-brand-900 sm:text-sm">{label}</span>
          {sublabel && <span className="text-[11px] text-brand-600">{sublabel}</span>}
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="เลือกวันที่"
            onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
          />
        </label>
        <Arrow href={href({ [param]: next === today ? null : next })} dir="next" label="วันถัดไป" />
      </div>
      {date !== today && (
        <button type="button" onClick={() => go(today)} className="rounded-full border border-brand-200 px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50">
          วันนี้
        </button>
      )}
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

/** ช่องเลือกที่เปลี่ยนแล้วกรองทันที (เก็บค่าใน URL) */
export function FilterSelect({
  param,
  value,
  options,
  placeholder,
  icon,
  className,
}: {
  param: string;
  value: string;
  options: Array<{ value: string | number; label: string }>;
  placeholder: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const href = useQueryHref();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className={cn("relative flex min-h-11 items-center rounded-full border border-brand-200 bg-white transition hover:border-brand-300 sm:min-h-10", pending && "opacity-60", className)}>
      {icon && <span className="pointer-events-none absolute left-3.5 text-brand-500">{icon}</span>}
      <select
        value={value}
        onChange={(e) => start(() => router.push(href({ [param]: e.target.value || null }), { scroll: false }))}
        className={cn("h-full w-full cursor-pointer appearance-none rounded-full bg-transparent py-2 pr-9 text-[15px] text-brand-900 outline-none focus-visible:ring-4 focus-visible:ring-brand-100 sm:text-sm", icon ? "pl-10" : "pl-4")}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 size-4 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}
