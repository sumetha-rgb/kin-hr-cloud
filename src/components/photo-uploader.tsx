/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { savePhoto } from "@/app/(app)/account/actions";
import { Avatar } from "./avatar";

const SIZE = 480; // px สี่เหลี่ยมจัตุรัส — คมพอสำหรับจอ retina และไฟล์เล็ก (~40-70KB)

/** ตัดกลางเป็นสี่เหลี่ยมจัตุรัสแล้วย่อเป็น JPEG ในเบราว์เซอร์ ไม่ต้องอัปโหลดไฟล์ใหญ่จากมือถือ */
async function toSquareJpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  const img: CanvasImageSource & { width: number; height: number } =
    bmp ??
    (await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("เปิดไฟล์รูปไม่ได้"));
      i.src = URL.createObjectURL(file);
    }));
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function PhotoUploader({
  employeeId,
  name,
  version,
  back,
  size = 112,
}: {
  employeeId: number;
  name: string;
  version: number | null;
  back: string;
  size?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(f: File | undefined) {
    if (!f) return;
    setErr(null);
    if (!f.type.startsWith("image/")) return setErr("กรุณาเลือกไฟล์รูปภาพ");
    try {
      setPreview(await toSquareJpeg(f));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group relative rounded-full focus-visible:outline-3 focus-visible:outline-brand-300"
        aria-label="เปลี่ยนรูปโปรไฟล์"
      >
        {preview ? (
          <img src={preview} alt="ตัวอย่างรูปใหม่" width={size} height={size} className="rounded-full object-cover shadow-md ring-4 ring-white" style={{ width: size, height: size }} />
        ) : (
          <Avatar name={name} employeeId={employeeId} version={version} size={size} className="shadow-md ring-4 ring-white" />
        )}
        <span className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full bg-brand-600 text-white shadow ring-3 ring-white transition group-hover:bg-brand-700">
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />

      <form ref={formRef} action={savePhoto} onSubmit={() => setBusy(true)} className="flex flex-wrap justify-center gap-2">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="back" value={back} />
        {preview ? (
          <>
            <input type="hidden" name="photo" value={preview} />
            <button disabled={busy} className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50">
              {busy ? "กำลังบันทึก…" : "บันทึกรูป"}
            </button>
            <button type="button" disabled={busy} onClick={() => setPreview(null)} className="rounded-full border border-brand-200 bg-white px-4 py-1.5 text-sm text-brand-800 hover:bg-brand-50">
              ยกเลิก
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-brand-200 bg-white px-4 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-50">
              {version ? "เปลี่ยนรูป" : "เพิ่มรูปโปรไฟล์"}
            </button>
            {version && (
              <button
                name="remove"
                value="1"
                disabled={busy}
                onClick={(e) => {
                  if (!confirm("ลบรูปโปรไฟล์?")) e.preventDefault();
                }}
                className="rounded-full px-3 py-1.5 text-sm text-stone-500 hover:bg-rose-50 hover:text-rose-700"
              >
                ลบรูป
              </button>
            )}
          </>
        )}
      </form>
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </div>
  );
}
