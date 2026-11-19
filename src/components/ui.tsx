import Link from "next/link";
import { cn } from "@/lib/util";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold text-brand-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-brand-700">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions, padded = true }: { title?: React.ReactNode; children: React.ReactNode; className?: string; actions?: React.ReactNode; padded?: boolean }) {
  return (
    <section className={cn("rounded-2xl border border-brand-200 bg-white shadow-[0_1px_2px_rgba(44,30,15,0.04)]", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-brand-100 px-4 py-3">
          <h2 className="font-semibold text-brand-800">{title}</h2>
          {actions}
        </div>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

const statTone = {
  default: { text: "text-brand-900", chip: "bg-brand-100 text-brand-700" },
  good: { text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700" },
  warn: { text: "text-amber-700", chip: "bg-amber-50 text-amber-700" },
  bad: { text: "text-rose-700", chip: "bg-rose-50 text-rose-700" },
};
export function Stat({ label, value, hint, tone = "default", icon }: { label: string; value: React.ReactNode; hint?: string; tone?: keyof typeof statTone; icon?: React.ReactNode }) {
  const t = statTone[tone];
  return (
    <div className="rounded-2xl border border-brand-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-stone-600">{label}</div>
        {icon && <span className={cn("flex size-8 items-center justify-center rounded-lg", t.chip)}>{icon}</span>}
      </div>
      <div className={cn("mt-1 text-[26px] leading-tight font-semibold tabular-nums", t.text)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[15px] font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:text-sm";
export const btn = {
  primary: cn(btnBase, "bg-brand-600 text-white shadow-sm hover:bg-brand-700"),
  secondary: cn(btnBase, "border border-brand-200 bg-white text-brand-800 hover:bg-brand-50"),
  danger: cn(btnBase, "bg-rose-600 text-white hover:bg-rose-700"),
  ghost: cn(btnBase, "min-h-9 px-3 text-brand-700 hover:bg-brand-50 sm:min-h-9"),
  success: cn(btnBase, "bg-emerald-600 text-white hover:bg-emerald-700"),
};

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: keyof typeof btn }) {
  return (
    <Link href={href} className={btn[variant]}>
      {children}
    </Link>
  );
}

export const inputCls =
  "w-full min-h-11 rounded-xl border border-brand-200 bg-white px-3 py-2 text-base text-brand-900 outline-none placeholder:text-stone-400 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 disabled:bg-brand-50 sm:min-h-10 sm:text-sm";

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-sm font-medium text-brand-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn(inputCls, props.className)} />;
}

export function Select({ options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string | number; label: string }>; placeholder?: string }) {
  return (
    <select {...props} className={cn(inputCls, props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex items-start gap-2.5 py-1 text-[15px] text-brand-900 sm:text-sm">
      <input type="checkbox" {...props} className="mt-0.5 size-5 shrink-0 rounded border-brand-300 accent-brand-600 sm:size-4" />
      {label}
    </label>
  );
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-200 bg-white">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-brand-50 text-left text-brand-700">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-100 [&_td]:px-3 [&_td]:py-2.5">
          {children}
          {empty && (
            <tr>
              <td colSpan={head.length} className="py-10! text-center text-stone-400">
                ยังไม่มีข้อมูล
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** รายการแบบการ์ดสำหรับมือถือ (ใช้คู่กับ Table ที่ซ่อนบนจอเล็ก) */
export function MobileList({ children, empty }: { children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="space-y-2.5 md:hidden">
      {empty ? <div className="rounded-2xl border border-dashed border-brand-200 bg-white p-8 text-center text-stone-400">ยังไม่มีข้อมูล</div> : children}
    </div>
  );
}

export function MobileCard({ href, children, className }: { href?: string; children: React.ReactNode; className?: string }) {
  const cls = cn("block rounded-2xl border border-brand-200 bg-white p-4 active:bg-brand-50", className);
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function DesktopOnly({ children }: { children: React.ReactNode }) {
  return <div className="hidden md:block">{children}</div>;
}

const badgeTone = {
  gray: "bg-stone-100 text-stone-600",
  blue: "bg-sky-50 text-sky-700",
  gold: "bg-brand-100 text-brand-800",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-rose-50 text-rose-700",
};
export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: keyof typeof badgeTone }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", badgeTone[tone])}>{children}</span>;
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "mb-4 rounded-xl border px-4 py-3 text-[15px] sm:text-sm",
        error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {error ? "⚠️ " : "✅ "}
      {error ?? ok}
    </div>
  );
}

export function Tabs({ items, active }: { items: Array<{ href: string; label: string; key: string }>; active: string }) {
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-brand-200 px-4 sm:mx-0 sm:px-0">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2.5 text-[15px] whitespace-nowrap sm:text-sm",
            t.key === active ? "border-brand-600 font-medium text-brand-800" : "border-transparent text-stone-500 hover:text-brand-800",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
