"use client";

import { useActionState, useRef } from "react";
import { login } from "./actions";
import { btn, inputCls } from "@/components/ui";

// บัญชี HR สำหรับทดลองระบบ (ข้อมูลจำลอง) — กดปุ่มเดียวเข้าสู่ระบบได้เลย
const HR_DEMO = { username: "e0002", password: "Demo@1234" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  function loginAsHr() {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("username") as HTMLInputElement).value = HR_DEMO.username;
    (form.elements.namedItem("password") as HTMLInputElement).value = HR_DEMO.password;
    form.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-brand-800">ชื่อผู้ใช้ (รหัสพนักงาน)</span>
        <input name="username" autoComplete="username" autoCapitalize="none" required className={inputCls} placeholder="เช่น e0014" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-brand-800">รหัสผ่าน</span>
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </label>
      {state?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">⚠️ {state.error}</p>}
      <button disabled={pending} className={`${btn.primary} min-h-12! w-full text-base`}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
      <div className="flex items-center gap-3 text-xs text-stone-400">
        <span className="h-px flex-1 bg-brand-100" />
        หรือ
        <span className="h-px flex-1 bg-brand-100" />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={loginAsHr}
        className="min-h-12 w-full rounded-full border border-brand-300 bg-brand-50 text-base font-medium text-brand-800 transition hover:bg-brand-100 disabled:opacity-50"
      >
        เข้าสู่บัญชี HR (ทดลอง)
      </button>
    </form>
  );
}
