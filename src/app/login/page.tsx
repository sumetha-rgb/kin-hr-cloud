/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,#f5ede2,#faf7f4_60%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/kin-logo.png" alt="KIN Rehabilitation & Homecare" width={112} height={112} className="mx-auto" />
          <h1 className="mt-2 text-2xl font-semibold text-brand-900">KIN HR</h1>
          <p className="text-sm text-brand-700">ระบบบริหารงานบุคคล · KIN Rehabilitation &amp; Homecare</p>
        </div>
        <div className="rounded-2xl border border-brand-200 bg-white p-6 shadow-[0_8px_30px_rgba(120,89,58,0.08)] sm:p-7">
          <LoginForm next={next ?? "/"} />
        </div>
        <p className="mt-4 text-center text-xs text-stone-500">ลืมรหัสผ่าน กรุณาติดต่อฝ่ายบุคคล</p>
      </div>
    </main>
  );
}
