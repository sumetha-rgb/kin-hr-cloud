"use client";

import { btn } from "./ui";

export function PrintButton({ label = "พิมพ์ / บันทึก PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className={btn.secondary}>
      🖨️ {label}
    </button>
  );
}
