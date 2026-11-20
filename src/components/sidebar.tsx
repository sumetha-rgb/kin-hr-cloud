"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/util";
import { Avatar } from "./avatar";
import { KinLogo } from "./brand";
import { Icon } from "./icons";

export { Icon }; // ไฟล์เดิมหลายไฟล์ import Icon จากที่นี่

export type NavItem = { href: string; label: string; sub?: string; icon: string; short?: string; badge?: number };

function CountBadge({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white tabular-nums", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function Sidebar({
  items,
  mobileItems,
  user,
  logoutAction,
  unread = 0,
}: {
  items: NavItem[];
  /** ไม่เกิน 4 รายการ แสดงในแถบล่างของมือถือ (ช่องที่ 5 คือปุ่ม "เมนู") */
  mobileItems: NavItem[];
  user: { name: string; role: string; employeeId: number | null; photoVersion: number | null };
  logoutAction: () => Promise<void>;
  /** จำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน */
  unread?: number;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  const nav = (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      <div className="px-3 pb-2 text-[11px] font-medium tracking-[0.14em] text-stone-400 uppercase">เมนู</div>
      {items.map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] transition",
              active ? "bg-gradient-to-r from-brand-400 to-brand-500 font-medium text-white shadow-md shadow-brand-500/30" : "text-stone-600 hover:bg-brand-50 hover:text-brand-900",
            )}
          >
            <span className={cn("flex size-8 items-center justify-center rounded-xl transition", active ? "bg-white/25" : "bg-brand-50 text-brand-500 group-hover:bg-brand-100")}>
              <Icon name={it.icon} className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              {it.label}
              {it.sub && <span className={cn("block text-[11px] font-normal", active ? "text-white/85" : "text-stone-400")}>{it.sub}</span>}
            </span>
            <CountBadge n={it.badge} className={active ? "bg-white text-rose-600" : undefined} />
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* แถบบนมือถือ */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-brand-200/70 bg-white/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <Link href="/">
          <KinLogo size={36} />
        </Link>
        <Link href="/notifications" className="relative ml-auto flex size-10 items-center justify-center rounded-full text-brand-700 active:bg-brand-50" aria-label={`การแจ้งเตือน${unread ? ` (${unread} ใหม่)` : ""}`}>
          <Icon name="bell" className="size-[22px]" />
          <CountBadge n={unread} className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 text-[10px] ring-2 ring-white" />
        </Link>
        <Link href="/account" className="flex max-w-[50%] items-center gap-2 rounded-full py-1 pr-1 pl-2 active:bg-brand-50" aria-label="โปรไฟล์ของฉัน">
          <span className="hidden truncate text-right text-sm leading-tight text-brand-800 min-[420px]:block">
            {user.name}
            <span className="block text-[11px] text-brand-600">{user.role}</span>
          </span>
          <Avatar name={user.name} employeeId={user.employeeId} version={user.photoVersion} size={36} ring />
        </Link>
      </header>

      {/* เมนูเต็ม: คอม = แถบซ้ายถาวร · มือถือ = ลิ้นชัก */}
      {open && <div className="fixed inset-0 z-40 bg-brand-900/50 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-brand-200/80 bg-white shadow-2xl transition-transform lg:w-64 lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <Link href="/">
            <KinLogo size={42} />
          </Link>
          <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-brand-700 hover:bg-brand-50 lg:hidden" aria-label="ปิดเมนู">
            <Icon name="x" className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="p-3">
          <div className="rounded-2xl bg-brand-50/70 p-2 ring-1 ring-brand-200/70">
            <Link href="/account" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white">
              <Avatar name={user.name} employeeId={user.employeeId} version={user.photoVersion} size={40} className="ring-2 ring-white" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-medium text-brand-900">{user.name}</span>
                <span className="block text-xs text-brand-600">{user.role} · ดูโปรไฟล์</span>
              </span>
            </Link>
            <form action={logoutAction}>
              <button className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-stone-500 transition hover:bg-white hover:text-rose-700">ออกจากระบบ</button>
            </form>
          </div>
        </div>
      </aside>

      {/* แถบล่างมือถือ — กดง่ายด้วยนิ้วโป้ง */}
      <nav
        className="no-print fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-3xl border border-brand-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-lift backdrop-blur-md lg:hidden"
        aria-label="เมนูหลัก"
      >
        {mobileItems.slice(0, 4).map((it) => {
          const active = isActive(it.href);
          const scan = it.icon === "finger";
          return (
            <Link key={it.href} href={it.href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", active ? "font-semibold text-brand-800" : "text-stone-500")}>
              {scan ? (
                <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lg shadow-brand-700/40 ring-4 ring-white">
                  <Icon name="finger" className="size-7" />
                </span>
              ) : (
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition", active && "bg-brand-100")}>
                  <Icon name={it.icon} className="size-[22px]" />
                </span>
              )}
              <span className="leading-none">{it.short ?? it.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-stone-500" aria-label="เปิดเมนูทั้งหมด">
          <span className="flex h-7 w-12 items-center justify-center">
            <Icon name="menu" className="size-[22px]" />
          </span>
          <span className="leading-none">เมนู</span>
        </button>
      </nav>
    </>
  );
}
