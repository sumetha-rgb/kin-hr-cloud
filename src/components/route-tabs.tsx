"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/util";

export function RouteTabs({ items }: { items: Array<{ href: string; label: string }> }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {items.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-full px-4 py-2 text-[15px] whitespace-nowrap transition sm:text-sm",
              active ? "bg-brand-900 font-medium text-white shadow-sm" : "border border-brand-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-900",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
