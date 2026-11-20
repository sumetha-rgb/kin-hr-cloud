import Link from "next/link";
import { Children, cloneElement, Fragment, isValidElement } from "react";
import { cn } from "@/lib/util";
import { ClickableRows } from "./clickable-rows";
import { Icon } from "./icons";

/** ลิงก์ข้อความ + ลูกศรไอคอน เช่น "ดูทั้งหมด ›" (ใช้แทนตัวอักษร ›) */
export function MoreLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-0.5 text-sm font-medium text-brand-700 hover:text-brand-900", className)}>
      {children}
      <Icon name="chevronRight" className="size-4" />
    </Link>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[24px] leading-tight font-semibold tracking-tight text-brand-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-brand-700/90">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  className,
  actions,
  padded = true,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cn("rounded-3xl border border-brand-200/80 bg-white shadow-card", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
          <div className="min-w-0">
            <h2 className="font-semibold text-brand-900">{title}</h2>
            {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? "p-5" : "pb-2"}>{children}</div>
    </section>
  );
}

/** แถวข้อมูลแบบ ป้าย : ค่า (ใช้ในหน้าโปรไฟล์/รายละเอียด) */
export function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-brand-100 py-2.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
      <dt className="shrink-0 text-sm text-stone-500">{label}</dt>
      <dd className="text-right text-[15px] font-medium text-brand-900 sm:text-sm">{value || "-"}</dd>
    </div>
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
    <div className="rounded-3xl border border-brand-200/80 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-stone-600">{label}</div>
        {icon && <span className={cn("flex size-9 items-center justify-center rounded-xl", t.chip)}>{icon}</span>}
      </div>
      <div className={cn("mt-2 text-[28px] leading-tight font-semibold tracking-tight tabular-nums", t.text)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 py-2 text-[15px] font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-300 sm:min-h-10 sm:text-sm";
export const btn = {
  primary: cn(btnBase, "bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-700/30 hover:from-brand-600 hover:to-brand-800"),
  secondary: cn(btnBase, "border border-brand-200 bg-white text-brand-800 shadow-sm hover:border-brand-300 hover:bg-brand-50"),
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
  "w-full min-h-11 rounded-xl border border-brand-200 bg-brand-50/40 px-3.5 py-2 text-base text-brand-900 outline-none transition placeholder:text-stone-400 hover:border-brand-300 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 disabled:bg-brand-50 sm:min-h-10 sm:text-sm";

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-sm font-medium text-brand-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

/** รวม class ของช่องกรอก — ถ้าส่งความกว้างมาเอง (w-auto, w-40 …) ให้ตัด w-full ทิ้ง ไม่งั้น w-full ชนะใน CSS */
export function fieldClass(extra?: string) {
  const base = extra && /(^|\s)(w-|min-w-|flex-1)/.test(extra) ? inputCls.replace("w-full ", "") : inputCls;
  return cn(base, extra);
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={fieldClass(props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={fieldClass(props.className)} />;
}

export function Select({ options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string | number; label: string }>; placeholder?: string }) {
  return (
    <select {...props} className={fieldClass(props.className)}>
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

/** ใส่ data-label (ชื่อหัวคอลัมน์) ให้ทุก <td> เพื่อให้บนมือถือแสดงเป็นการ์ด "หัวข้อ : ค่า" ได้เอง */
function labelCells(node: React.ReactNode, labels: string[]): React.ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as React.ReactElement<{ children?: React.ReactNode }>;
    if (el.type === Fragment) return labelCells(el.props.children, labels);
    if (el.type !== "tr") return el;
    // แถวที่มี data-href: คลิกได้ทั้งแถว + โฟกัสด้วยคีย์บอร์ดได้
    const href = (el.props as { "data-href"?: string })["data-href"];
    const rowProps = href
      ? { tabIndex: 0, role: "link", className: cn((el.props as { className?: string }).className, "cursor-pointer focus-visible:bg-brand-50 focus-visible:outline-none") }
      : {};
    let col = 0;
    const cells = Children.map(el.props.children, (td) => {
      if (!isValidElement(td) || td.type !== "td") return td;
      const props = td.props as { colSpan?: number; "data-label"?: string };
      const label = props["data-label"] ?? labels[col] ?? "";
      col += props.colSpan ?? 1;
      return cloneElement(td as React.ReactElement<Record<string, unknown>>, { "data-label": label });
    });
    return cloneElement(el as React.ReactElement<Record<string, unknown>>, rowProps, cells);
  });
}

/**
 * ตารางของทั้งระบบ — ไม่มีแถบเลื่อนแนวนอน
 * คอม: กว้างพอดีกรอบ ข้อความยาวขึ้นบรรทัดใหม่ · มือถือ (<768px): แต่ละแถวเป็นการ์ด แสดงชื่อคอลัมน์คู่กับค่า
 * ช่องที่หัวคอลัมน์ว่าง (เช่น ปุ่ม) จะแสดงเต็มบรรทัดไม่มีป้าย
 */
export function Table({ head, children, empty, className }: { head: React.ReactNode[]; children: React.ReactNode; empty?: boolean; className?: string }) {
  const labels = head.map((h) => (typeof h === "string" ? h : ""));
  return (
    <ClickableRows className={cn("overflow-hidden rounded-3xl border border-brand-200/80 bg-white shadow-card", className)}>
      <table className="rtable w-full text-sm">
        <thead className="bg-brand-50/80 text-left text-xs tracking-wide text-brand-700">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2.5 align-bottom font-medium first:pl-4 last:pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-100 md:[&_td]:px-3 md:[&_td]:py-3 md:[&_td:first-child]:pl-4 md:[&_td:last-child]:pr-4 [&_tr]:transition-colors md:[&_tr:hover]:bg-brand-50/50">
          {labelCells(children, labels)}
          {empty && (
            <tr>
              <td colSpan={head.length} data-label="" className="rtable-empty py-10! text-center text-stone-400">
                ยังไม่มีข้อมูล
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ClickableRows>
  );
}

/** รายการแบบการ์ดสำหรับมือถือ (ใช้คู่กับ Table ที่ซ่อนบนจอเล็ก) */
export function MobileList({ children, empty }: { children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="space-y-2.5 md:hidden">
      {empty ? <div className="rounded-3xl border border-dashed border-brand-200 bg-white p-8 text-center text-stone-400">ยังไม่มีข้อมูล</div> : children}
    </div>
  );
}

export function MobileCard({ href, children, className }: { href?: string; children: React.ReactNode; className?: string }) {
  const cls = cn("block rounded-3xl border border-brand-200/80 bg-white p-4 shadow-card transition active:scale-[.99] active:bg-brand-50", className);
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
        "animate-in no-print mb-4 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[15px] shadow-card sm:text-sm",
        error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      <Icon name={error ? "alert" : "checkCircle"} className="mt-px size-5 sm:size-[18px]" />
      <span>{error ?? ok}</span>
    </div>
  );
}

export function Tabs({ items, active }: { items: Array<{ href: string; label: string; key: string }>; active: string }) {
  return (
    <nav className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "rounded-full px-4 py-2 text-[15px] whitespace-nowrap transition sm:text-sm",
            t.key === active ? "bg-brand-900 font-medium text-white shadow-sm" : "border border-brand-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-900",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
