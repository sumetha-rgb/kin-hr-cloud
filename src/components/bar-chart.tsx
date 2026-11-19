"use client";

import { useState } from "react";
import { cn } from "@/lib/util";

export type BarDatum = { key: string; label: string; value: number; display: string; detail?: string };

/** กราฟแท่งชุดเดียว (สีทอง KIN #9c6e1f ผ่านเกณฑ์คอนทราสต์) · hover/แตะ = ดูค่า · มีมุมมองตาราง */
export function BarChart({
  data,
  max,
  orientation = "vertical",
  ariaLabel,
  highlightLast = true,
}: {
  data: BarDatum[];
  max?: number;
  orientation?: "vertical" | "horizontal";
  ariaLabel: string;
  highlightLast?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  const active = data.find((d) => d.key === hover);

  if (!data.length) return <p className="py-8 text-center text-sm text-stone-400">ยังไม่มีข้อมูล</p>;

  return (
    <figure aria-label={ariaLabel}>
      {orientation === "vertical" ? (
        <div className="relative">
          <div className="pointer-events-none mb-2 flex h-6 items-center justify-center text-sm">
            {active ? (
              <span className="rounded-md bg-brand-900 px-2 py-0.5 text-white">
                <strong className="tabular-nums">{active.display}</strong> · {active.detail ?? active.label}
              </span>
            ) : (
              <span className="text-stone-400">แตะแท่งกราฟเพื่อดูตัวเลข</span>
            )}
          </div>
          <div className="mt-4 flex h-40 items-end gap-[2px] border-b border-brand-200 sm:h-48">
            {data.map((d, i) => {
              const last = highlightLast && i === data.length - 1;
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-label={`${d.label} ${d.display}`}
                  onPointerEnter={() => setHover(d.key)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(d.key)}
                  onBlur={() => setHover(null)}
                  onClick={() => setHover(d.key)}
                  className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
                >
                  {last && (
                    <span className="absolute text-[11px] font-semibold text-brand-800 tabular-nums" style={{ bottom: `calc(${(d.value / top) * 100}% + 2px)`, top: "auto" }}>
                      {d.display}
                    </span>
                  )}
                  <span
                    className={cn("w-full max-w-7 rounded-t-[4px] transition", hover === d.key ? "opacity-100 brightness-110" : "opacity-90")}
                    style={{ height: `${Math.max(1.5, (d.value / top) * 100)}%`, background: "var(--color-chart)" }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex gap-[2px] text-[10px] text-stone-500 sm:text-[11px]">
            {data.map((d) => (
              <span key={d.key} className="flex-1 truncate text-center">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.map((d) => (
            <div key={d.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm" title={d.detail}>
              <span className="truncate text-brand-900">{d.label}</span>
              <span className="h-3 rounded-r-[4px]" style={{ width: `${Math.max(2, (d.value / top) * 100)}%`, background: "var(--color-chart)" }} />
              <span className="w-10 text-right font-medium text-brand-900 tabular-nums">{d.display}</span>
            </div>
          ))}
        </div>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-brand-700">ดูเป็นตาราง</summary>
        <table className="mt-2 w-full text-left">
          <tbody className="divide-y divide-brand-100">
            {data.map((d) => (
              <tr key={d.key}>
                <td className="py-1 text-stone-600">{d.detail ?? d.label}</td>
                <td className="py-1 text-right font-medium tabular-nums">{d.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
