/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/util";

// โทนพื้นหลังตัวอักษรย่อ (เลือกตามชื่อ ให้แต่ละคนสีคงที่)
const TONES = [
  "from-brand-300 to-brand-500 text-white",
  "from-amber-200 to-amber-400 text-amber-950",
  "from-emerald-200 to-emerald-400 text-emerald-950",
  "from-sky-200 to-sky-400 text-sky-950",
  "from-rose-200 to-rose-400 text-rose-950",
  "from-stone-300 to-stone-500 text-white",
];

function initials(name: string) {
  const parts = name.replace(/^(นาย|นางสาว|นาง)/, "").trim().split(/\s+/);
  // ข้ามสระหน้า (เ แ โ ใ ไ) ให้ได้พยัญชนะต้น เช่น "เอกชัย" → "อ"
  return parts.map((p) => [...p.replace(/^[เแโใไ]/, "")][0] ?? "").slice(0, 2).join("") || "?";
}

export function photoUrl(employeeId: number, version: number | null | undefined) {
  return version ? `/api/photo/${employeeId}?v=${version}` : null;
}

/** รูปโปรไฟล์ — ไม่มีรูปจะแสดงอักษรย่อบนพื้นสี */
export function Avatar({
  name,
  employeeId,
  version,
  size = 40,
  className,
  ring = false,
}: {
  name: string;
  employeeId?: number | null;
  version?: number | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const src = employeeId ? photoUrl(employeeId, version) : null;
  const tone = TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) };
  const base = cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", ring && "ring-2 ring-white shadow-sm", className);
  return src ? (
    <img src={src} alt={name} width={size} height={size} className={cn(base, "bg-brand-100 object-cover")} style={style} loading="lazy" />
  ) : (
    <span className={cn(base, "bg-gradient-to-br font-semibold select-none", tone)} style={style} aria-label={name}>
      {initials(name)}
    </span>
  );
}
