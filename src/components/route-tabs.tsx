"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/util";

export function RouteTabs({ items }: { items: Array<{ href: string; label: string }> }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-brand-200 px-4 sm:mx-0 sm:px-0">
      {items.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-[15px] whitespace-nowrap sm:text-sm",
              active ? "border-brand-600 font-medium text-brand-800" : "border-transparent text-stone-500 hover:text-brand-800",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
