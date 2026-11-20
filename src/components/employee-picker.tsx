"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/util";
import { Icon } from "./icons";

export type PickerOption = { id: number; code: string; name: string; nickname?: string | null; sub?: string | null };

/** ตัดวรรณยุกต์/ช่องว่าง/ตัวพิมพ์ ให้ค้นหาไทยได้ยืดหยุ่น เช่น "เสรฐ" เจอ "เสริฐ" ไม่ได้ แต่ "ประเสริฐ", "E0014", "e14" เจอ */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/[่้๊๋์]/g, "");

/**
 * ช่องเลือกพนักงานแบบพิมพ์ค้นหาได้ (ชื่อ / นามสกุล / ชื่อเล่น / รหัส)
 * ส่งค่าในฟอร์มผ่าน <input type="hidden" name={name}>
 * syncParam: เลือกแล้วอัปเดต ?param= ใน URL (ให้หน้าโหลดข้อมูลของพนักงานคนนั้น เช่น ประวัติใบเตือน)
 */
export function EmployeePicker({
  name,
  options,
  defaultValue,
  required,
  placeholder = "พิมพ์ชื่อ ชื่อเล่น หรือรหัสพนักงาน",
  syncParam,
  allowClear,
  variant = "field",
  className,
}: {
  name?: string;
  options: PickerOption[];
  defaultValue?: number;
  required?: boolean;
  placeholder?: string;
  syncParam?: string;
  /** แสดงปุ่มล้างค่า (ใช้ข้อความนี้แทนตอนยังไม่เลือก เช่น "พนักงานทุกคน", "ไม่มี (HR อนุมัติ)") */
  allowClear?: string;
  /** field = ช่องในฟอร์ม · filter = แคปซูลในแถบตัวกรอง (FilterBar) */
  variant?: "field" | "filter";
  className?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<PickerOption | null>(() => options.find((o) => o.id === defaultValue) ?? null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = norm(query);
    if (!q) return options.slice(0, 50);
    // รหัส: "14" หรือ "e14" ให้เจอ E0014 ด้วย
    const digits = q.replace(/^\D+/, "");
    return options
      .filter((o) => {
        const code = norm(o.code);
        return (
          norm(o.name).includes(q) ||
          (o.nickname && norm(o.nickname).includes(q)) ||
          code.includes(q) ||
          (digits && code.replace(/^\D+0*/, "").startsWith(digits.replace(/^0+/, "")))
        );
      })
      .slice(0, 50);
  }, [query, options]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  function sync(id: number | null) {
    if (!syncParam) return;
    const q = new URLSearchParams(sp.toString());
    if (id) q.set(syncParam, String(id));
    else q.delete(syncParam);
    q.delete("ok");
    q.delete("error");
    const s = q.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  }

  function choose(o: PickerOption) {
    setSelected(o);
    setQuery("");
    setOpen(false);
    sync(o.id);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setOpen(false);
    sync(null);
  }

  const filter = variant === "filter";

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault(); // ไม่ให้ส่งฟอร์มขณะเลือก
      if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={selected?.id ?? ""} />}

      {selected && !open ? (
        <div
          className={cn(
            "flex min-h-11 w-full items-center gap-2 border border-brand-200 bg-white py-1 pr-1 transition hover:border-brand-300 sm:min-h-10",
            filter ? "rounded-full pl-1.5" : "rounded-xl pl-2",
          )}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-label="เปลี่ยนพนักงาน"
          >
            <span className={cn("shrink-0 bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800 tabular-nums", filter ? "rounded-full" : "rounded-lg")}>{selected.code}</span>
            <span className="min-w-0 flex-1 truncate text-[15px] text-brand-900 sm:text-sm">
              {selected.name}
              {selected.nickname && <span className="text-stone-500"> ({selected.nickname})</span>}
            </span>
          </button>
          {allowClear ? (
            <button type="button" onClick={clear} className="flex size-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-brand-50 hover:text-rose-600" aria-label="ล้างค่า">
              <Icon name="x" className="size-4" />
            </button>
          ) : (
            <span className="pr-2 text-xs font-medium text-brand-600">เปลี่ยน</span>
          )}
        </div>
      ) : (
        <label className="relative block">
          <Icon name={filter ? "search" : "user"} className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-brand-400" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder={allowClear && !query ? allowClear : placeholder}
            // ถ้ายังไม่ได้เลือก ให้ฟอร์มเตือนตอนกดส่ง
            required={required && !selected}
            className={cn(
              "min-h-11 w-full border border-brand-200 bg-white py-2 pr-3 pl-10 text-base text-brand-900 outline-none transition placeholder:text-stone-500 hover:border-brand-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 sm:min-h-10 sm:text-sm",
              filter ? "rounded-full" : "rounded-xl",
            )}
          />
        </label>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="animate-in absolute top-full right-0 left-0 z-30 mt-1.5 max-h-72 min-w-72 overflow-y-auto rounded-2xl border border-brand-200 bg-white py-1.5 shadow-lift"
        >
          {allowClear && selected && !query && (
            <li>
              <button type="button" onClick={clear} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-600 hover:bg-brand-50">
                <Icon name="x" className="size-4" />
                {allowClear}
              </button>
            </li>
          )}
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-stone-500">ไม่พบพนักงานที่ตรงกับ “{query}”</li>
          ) : (
            results.map((o, i) => (
              <li key={o.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={cn("flex w-full items-center gap-3 px-3 py-2 text-left text-sm", i === active ? "bg-brand-50" : "", selected?.id === o.id && "font-semibold")}
                >
                  <span className="w-14 shrink-0 text-xs font-semibold text-brand-700 tabular-nums">{o.code}</span>
                  <span className="min-w-0 flex-1 truncate text-brand-900">
                    {o.name}
                    {o.nickname && <span className="text-stone-500"> ({o.nickname})</span>}
                  </span>
                  {o.sub && <span className="hidden shrink-0 text-xs text-stone-400 sm:inline">{o.sub}</span>}
                  {selected?.id === o.id && <Icon name="tick" className="size-4 text-brand-600" />}
                </button>
              </li>
            ))
          )}
          {!query && options.length > 50 && <li className="px-4 pt-2 pb-1 text-xs text-stone-400">พิมพ์เพื่อค้นหาเพิ่มเติม (ทั้งหมด {options.length} คน)</li>}
        </ul>
      )}
    </div>
  );
}
