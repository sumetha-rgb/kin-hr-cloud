"use client";

import { useRouter } from "next/navigation";

/**
 * ทำให้แถวตารางที่มี data-href คลิกได้ทั้งแถว (และกด Enter ได้)
 * ไม่ทำงานเมื่อคลิกโดนปุ่ม/ลิงก์/ช่องกรอกในแถว หรือเมื่อผู้ใช้กำลังลากคลุมข้อความ
 */
export function ClickableRows({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter();

  function go(target: EventTarget | null, newTab: boolean) {
    const el = target as HTMLElement | null;
    if (!el || el.closest("a, button, input, select, textarea, label, form, [role=combobox]")) return;
    const tr = el.closest<HTMLElement>("tr[data-href]");
    const href = tr?.dataset.href;
    if (!href) return;
    if (window.getSelection()?.toString()) return; // ลากคลุมข้อความเพื่อคัดลอก ไม่ใช่การคลิก
    if (newTab) window.open(href, "_blank");
    else router.push(href);
  }

  return (
    <div
      className={className}
      onClick={(e) => go(e.target, e.metaKey || e.ctrlKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).matches("tr[data-href]")) go(e.target, false);
      }}
    >
      {children}
    </div>
  );
}
