/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ" };

const FEATURES = [
  { t: "สแกนนิ้ว / Face ID ลงเวลา", d: "บนมือถือของพนักงาน พร้อมตรวจพิกัดสาขา" },
  { t: "ลา · OT · แก้เวลา ออนไลน์", d: "หัวหน้าอนุมัติได้ทันทีจากทุกที่" },
  { t: "เงินเดือนและสลิปอัตโนมัติ", d: "คำนวณประกันสังคมและภาษีให้ครบ" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* ฝั่งแบรนด์ (คอม) */}
      <section className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_80%_10%,rgba(220,196,160,.35),transparent_45%),linear-gradient(140deg,#5e4830_0%,#3a2817_45%,#24180b_100%)] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full border-[48px] border-white/[.04]" />
        <div className="pointer-events-none absolute top-1/3 -right-20 size-72 rounded-full border-[36px] border-brand-300/[.07]" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-lg">
            <img src="/kin-logo.png" alt="" width={46} height={46} />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-semibold tracking-wide">KIN HR</span>
            <span className="block text-sm text-brand-200/80">Rehabilitation &amp; Homecare</span>
          </span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-[34px] leading-tight font-semibold tracking-tight">
            ดูแลทีมงาน
            <br />
            <span className="text-brand-300">ง่ายขึ้นในที่เดียว</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.t} className="flex gap-3">
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-400/25 text-sm text-brand-200">✓</span>
                <span>
                  <span className="block font-medium">{f.t}</span>
                  <span className="block text-sm text-brand-200/75">{f.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-brand-300/60">© KIN Rehabilitation &amp; Homecare</p>
      </section>

      {/* ฟอร์ม */}
      <section className="flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#f5ede2,transparent_60%)] p-5 sm:p-10">
        <div className="animate-in w-full max-w-sm">
          <div className="mb-7 text-center lg:text-left">
            <img src="/kin-logo.png" alt="KIN Rehabilitation & Homecare" width={88} height={88} className="mx-auto lg:hidden" />
            <h1 className="mt-3 text-[26px] font-semibold tracking-tight text-brand-900 lg:mt-0">ยินดีต้อนรับ 👋</h1>
            <p className="mt-1 text-[15px] text-brand-700">เข้าสู่ระบบ KIN HR ด้วยรหัสพนักงานของคุณ</p>
          </div>
          <div className="rounded-3xl border border-brand-200/80 bg-white p-6 shadow-lift sm:p-7">
            <LoginForm next={next ?? "/"} />
          </div>
          <p className="mt-5 text-center text-sm text-stone-500">ลืมรหัสผ่าน กรุณาติดต่อฝ่ายบุคคล</p>
        </div>
      </section>
    </main>
  );
}
