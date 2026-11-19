"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/util";
import { KinLogo } from "./brand";

export type NavItem = { href: string; label: string; sub?: string; icon: string; short?: string };

const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  finger: "M12 11v6m-4-4c0-2.2 1.8-4 4-4s4 1.8 4 4v1m-12-1a8 8 0 0 1 16 0v2M7 19a10 10 0 0 0 1-4",
  org: "M4 21V7l8-4 8 4v14M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01",
  people: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m20 0v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  check: "M9 12l2 2 4-4M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2",
  money: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 7V5h12v2",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  menu: "M4 6h16M4 12h16M4 18h16",
};

export function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name] ?? ICONS.home} />
    </svg>
  );
}

export function Sidebar({
  items,
  mobileItems,
  user,
  logoutAction,
}: {
  items: NavItem[];
  /** ไม่เกิน 4 รายการ แสดงในแถบล่างของมือถือ (ช่องที่ 5 คือปุ่ม "เมนู") */
  mobileItems: NavItem[];
  user: { name: string; role: string };
  logoutAction: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition",
              active ? "bg-brand-100 font-semibold text-brand-900" : "text-stone-600 hover:bg-brand-50 hover:text-brand-900",
            )}
          >
            {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-brand-500" />}
            <Icon name={it.icon} className={cn("size-5", active ? "text-brand-600" : "text-brand-400")} />
            <span className="leading-tight">
              {it.label}
              {it.sub && <span className="block text-[11px] font-normal text-stone-500">{it.sub}</span>}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* แถบบนมือถือ */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-brand-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/">
          <KinLogo size={36} />
        </Link>
        <span className="max-w-[45%] truncate text-right text-sm text-brand-700">{user.name}</span>
      </header>

      {/* เมนูเต็ม: คอม = แถบซ้ายถาวร · มือถือ = ลิ้นชัก */}
      {open && <div className="fixed inset-0 z-40 bg-brand-900/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-brand-200 bg-white shadow-xl transition-transform lg:w-64 lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-brand-100 bg-gradient-to-b from-brand-50 to-white px-4 py-4">
          <KinLogo size={42} />
          <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-brand-700 hover:bg-brand-50 lg:hidden" aria-label="ปิดเมนู">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-brand-100 p-3">
          <div className="px-3 pb-2 text-sm font-medium text-brand-900">
            {user.name}
            <span className="block text-xs font-normal text-brand-600">{user.role}</span>
          </div>
          <form action={logoutAction}>
            <button className="w-full rounded-xl border border-brand-200 px-3 py-2.5 text-left text-sm text-brand-800 hover:bg-brand-50">ออกจากระบบ</button>
          </form>
        </div>
      </aside>

      {/* แถบล่างมือถือ — กดง่ายด้วยนิ้วโป้ง */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-brand-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="เมนูหลัก"
      >
        {mobileItems.slice(0, 4).map((it) => {
          const active = isActive(it.href);
          const scan = it.icon === "finger";
          return (
            <Link key={it.href} href={it.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "font-semibold text-brand-700" : "text-stone-500")}>
              {scan ? (
                <span className="-mt-6 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lg ring-4 ring-white">
                  <Icon name="finger" className="size-7" />
                </span>
              ) : (
                <Icon name={it.icon} className="size-6" />
              )}
              <span className="leading-none">{it.short ?? it.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-stone-500" aria-label="เปิดเมนูทั้งหมด">
          <Icon name="menu" className="size-6" />
          <span className="leading-none">เมนู</span>
        </button>
      </nav>
    </>
  );
}
