"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { btn } from "./ui";

/** เติมพิกัดปัจจุบันลงช่อง latitude/longitude ของฟอร์ม (ใช้ตอนตั้งค่าสาขา โดยยืนอยู่ที่สาขา) */
export function GpsFillButton({ latId, lngId }: { latId: string; lngId: string }) {
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={btn.secondary}
        onClick={() => {
          if (!navigator.geolocation) return setMsg("อุปกรณ์ไม่รองรับ GPS");
          setMsg("กำลังหาตำแหน่ง…");
          navigator.geolocation.getCurrentPosition(
            (p) => {
              (document.getElementById(latId) as HTMLInputElement).value = p.coords.latitude.toFixed(6);
              (document.getElementById(lngId) as HTMLInputElement).value = p.coords.longitude.toFixed(6);
              setMsg(`ความแม่นยำ ±${Math.round(p.coords.accuracy)} ม.`);
            },
            (e) => setMsg(e.message),
            { enableHighAccuracy: true, timeout: 15000 },
          );
        }}
      >
        <Icon name="locate" className="size-[18px]" />
        ใช้ตำแหน่งปัจจุบัน
      </button>
      <span className="text-xs text-stone-500">{msg}</span>
    </div>
  );
}
