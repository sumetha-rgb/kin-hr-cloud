"use client";

import { startTransition, useActionState, useState } from "react";
import { login } from "./actions";
import { cn } from "@/lib/util";

export type DemoAccount = { key: "hr" | "emp"; username: string; password: string; label: string; desc: string };

const fieldCls =
  "peer w-full min-h-13 rounded-2xl border border-brand-200 bg-white pr-4 pl-12 text-base text-brand-900 outline-none transition placeholder:text-stone-400 hover:border-brand-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

function FieldIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brand-400 transition peer-focus:text-brand-600"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/** demo: ส่งมาจากเซิร์ฟเวอร์เฉพาะตอน HR เปิดปุ่มบัญชีทดลอง (ปิดแล้วรหัสจะไม่อยู่ในหน้าเว็บเลย) */
export function LoginForm({ next, demo }: { next: string; demo: DemoAccount[] }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [show, setShow] = useState(false);
  // ควบคุมค่าเองเพื่อไม่ให้ชื่อผู้ใช้ถูกล้างเมื่อรหัสผ่านผิด (React ล้างฟอร์มหลังส่งทุกครั้ง)
  const [username, setUsername] = useState("");

  function loginAsDemo(d: DemoAccount) {
    setUsername(d.username);
    const fd = new FormData();
    fd.set("next", next);
    fd.set("username", d.username);
    fd.set("password", d.password);
    startTransition(() => action(fd));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-brand-800">ชื่อผู้ใช้</span>
        <span className="relative block">
          <input name="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus className={fieldCls} placeholder="รหัสพนักงาน เช่น e0014" />
          <FieldIcon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-brand-800">รหัสผ่าน</span>
        <span className="relative block">
          <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className={cn(fieldCls, "pr-14")} placeholder="••••••••" />
          <FieldIcon d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
            aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          >
            {show ? "ซ่อน" : "แสดง"}
          </button>
        </span>
      </label>

      {state?.error && (
        <p role="alert" className="animate-in flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span aria-hidden>⚠️</span>
          {state.error}
        </p>
      )}

      <button
        disabled={pending}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-600 hover:to-brand-800 active:scale-[.99] disabled:opacity-60"
      >
        {pending ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            กำลังเข้าสู่ระบบ…
          </>
        ) : (
          <>เข้าสู่ระบบ →</>
        )}
      </button>

      {demo.length > 0 && (
        <>
      <div className="flex items-center gap-3 pt-1 text-xs text-stone-400">
        <span className="h-px flex-1 bg-brand-100" />
        หรือทดลองใช้งาน
        <span className="h-px flex-1 bg-brand-100" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {demo.map((d) => (
          <button
            key={d.key}
            type="button"
            disabled={pending}
            onClick={() => loginAsDemo(d)}
            className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 px-2 py-3 transition hover:border-brand-400 hover:bg-brand-100/70 active:scale-[.98] disabled:opacity-50"
          >
            <span className={cn("flex size-9 items-center justify-center rounded-full text-white shadow-sm", d.key === "hr" ? "bg-brand-700" : "bg-emerald-600")}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={d.key === "hr" ? "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m20 0v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8" : "M12 11v6m-4-4c0-2.2 1.8-4 4-4s4 1.8 4 4v1m-12-1a8 8 0 0 1 16 0v2M7 19a10 10 0 0 0 1-4"} />
              </svg>
            </span>
            <span className="text-[15px] font-semibold text-brand-900">{d.label} (ทดลอง)</span>
            <span className="text-xs text-stone-500">{d.desc}</span>
          </button>
        ))}
      </div>
        </>
      )}
    </form>
  );
}
