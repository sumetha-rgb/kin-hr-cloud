/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/util";

/** โลโก้ KIN ทางการ (จาก kinrehab.com) + ชื่อระบบ */
export function KinLogo({ size = 40, dark = false, showText = true, className }: { size?: number; dark?: boolean; showText?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn("inline-flex shrink-0 items-center justify-center rounded-xl", dark ? "bg-white/5 ring-1 ring-brand-400/30" : "bg-white ring-1 ring-brand-200 shadow-sm")}
        style={{ width: size, height: size }}
      >
        <img src="/kin-logo.png" alt="KIN Rehabilitation & Homecare" width={size * 0.86} height={size * 0.86} />
      </span>
      {showText && (
        <span className="leading-tight">
          <span className={cn("block font-semibold tracking-wide", dark ? "text-brand-100" : "text-brand-900")}>KIN HR</span>
          <span className={cn("block text-[11px]", dark ? "text-brand-300/80" : "text-brand-700")}>Rehabilitation &amp; Homecare</span>
        </span>
      )}
    </span>
  );
}
