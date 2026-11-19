"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { btn, inputCls } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
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
    </form>
  );
}
