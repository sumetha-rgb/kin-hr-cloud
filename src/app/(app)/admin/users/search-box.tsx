"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/util";

/** ช่องค้นหาที่กรองเองเมื่อหยุดพิมพ์ (0.4 วินาที) — เก็บค่าใน ?q= */
export function SearchBox({ value, placeholder, param = "q" }: { value: string; placeholder: string; param?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [text, setText] = useState(value);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => {
      const q = new URLSearchParams(sp.toString());
      q.delete("ok");
      q.delete("error");
      if (text.trim()) q.set(param, text.trim());
      else q.delete(param);
      start(() => router.replace(`${path}?${q.toString()}`, { scroll: false }));
    }, 400);
    return () => clearTimeout(t);
  }, [text, value, sp, path, param, router]);

  return (
    <label className={cn("relative flex min-h-11 min-w-56 flex-1 items-center rounded-full border border-brand-200 bg-white transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100 sm:min-h-10", pending && "opacity-70")}>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 size-4 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
      </svg>
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-full w-full rounded-full bg-transparent py-2 pr-4 pl-10 text-[15px] text-brand-900 outline-none placeholder:text-stone-400 sm:text-sm"
      />
    </label>
  );
}
