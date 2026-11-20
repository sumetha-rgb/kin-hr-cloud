"use client";

import { Icon } from "./icons";
import { btn } from "./ui";

export function PrintButton({ label = "พิมพ์ / บันทึก PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className={btn.secondary}>
      <Icon name="printer" className="size-[18px]" />
      {label}
    </button>
  );
}
