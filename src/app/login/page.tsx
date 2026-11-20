/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { InstallApp } from "@/components/install-app";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/payroll-run";
import { LoginForm, type DemoAccount } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ" };

// บัญชีทดลอง (ข้อมูลจำลอง) — อยู่ฝั่งเซิร์ฟเวอร์ ส่งไปหน้าเว็บเฉพาะตอนเปิดปุ่มทดลอง
const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: "hr", username: "e0002", password: "Demo@1234", label: "HR", desc: "จัดการทั้งระบบ" },
  { key: "emp", username: "demo2", password: "1234", label: "พนักงาน", desc: "ลงเวลา · ยื่นลา" },
];

const FEATURES: Array<{ icon: IconName; t: string }> = [
  { icon: "finger", t: "สแกนนิ้ว / Face ID" },
  { icon: "document", t: "ลา · OT ออนไลน์" },
  { icon: "money", t: "สลิปเงินเดือน" },
];

/** ภาพตัวอย่างหน้าจอลงเวลาบนมือถือ (วาดด้วย HTML ล้วน ไม่ต้องโหลดรูป) */
function PhonePreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-10 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="relative w-[280px] rounded-[44px] border-[10px] border-white bg-white shadow-[0_30px_80px_-20px_rgba(94,72,48,0.45)] ring-1 ring-brand-200">
        <div className="overflow-hidden rounded-[34px] bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-brand-900/90" />
          <div className="px-5 pt-5 pb-6 text-center">
            <p className="text-[11px] text-brand-600">วันพฤหัสบดี 19 พ.ย. 2569</p>
            <p className="mt-1 text-[40px] leading-none font-semibold tracking-tight text-brand-900 tabular-nums">08:02</p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
              <Icon name="pin" className="size-3.5" />
              อยู่ในพื้นที่ KIN ลาดพร้าว 71
            </span>
            <div className="mt-6 flex justify-center">
              <span className="relative flex size-28 flex-col items-center justify-center gap-1 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-700/30">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/25 [animation-duration:2.6s]" />
                <Icon name="finger" className="relative size-10" strokeWidth={1.5} />
                <span className="relative text-[12px] font-semibold">สแกนเข้างาน</span>
              </span>
            </div>
            <div className="mt-6 flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] font-medium text-emerald-700">
              <Icon name="checkCircle" className="size-4" />
              ลงเวลาเข้างานสำเร็จ 08:02 น.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  // ปุ่มบัญชีทดลอง: HR เปิด/ปิดได้ที่ ดูแลระบบ → ตั้งค่าระบบ (ถ้าอ่านฐานข้อมูลไม่ได้ ให้ซ่อนไว้ก่อน)
  const showDemo = await getSettings()
    .then((s) => s.demoLogin)
    .catch(() => false);
  const demo = showDemo ? DEMO_ACCOUNTS : [];
  return (
    <main className="relative grid min-h-dvh overflow-hidden bg-white lg:grid-cols-2">
      {/* ฟอร์ม */}
      <section className="relative flex flex-col px-5 py-8 sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute -top-32 -left-32 size-80 rounded-full bg-brand-100/80 blur-3xl lg:hidden" />
        <header className="relative flex items-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-brand-200">
            <img src="/kin-logo.png" alt="" width={36} height={36} />
          </span>
          <span className="leading-tight">
            <span className="block font-semibold tracking-wide text-brand-900">KIN HR</span>
            <span className="block text-[11px] text-brand-600">Rehabilitation &amp; Homecare</span>
          </span>
        </header>

        <div className="animate-in relative mx-auto my-auto w-full max-w-[400px] py-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            ระบบบริหารงานบุคคล
          </span>
          <h1 className="mt-4 text-[30px] leading-tight font-semibold tracking-tight text-brand-900 sm:text-[34px]">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-[15px] text-stone-500">ใช้รหัสพนักงานและรหัสผ่านที่ได้รับจากฝ่ายบุคคล</p>

          <div className="mt-8">
            <LoginForm next={next ?? "/"} demo={demo} />
          </div>

          <p className="mt-6 text-center text-sm text-stone-500">
            ลืมรหัสผ่าน? <span className="font-medium text-brand-700">ติดต่อฝ่ายบุคคล</span>
          </p>

          <InstallApp className="mt-6" />
        </div>

        <footer className="relative flex flex-wrap justify-center gap-2 lg:justify-start">
          {FEATURES.map((f) => (
            <span key={f.t} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs text-brand-700 ring-1 ring-brand-100">
              <Icon name={f.icon} className="size-3.5 text-brand-500" />
              {f.t}
            </span>
          ))}
        </footer>
      </section>

      {/* ภาพประกอบ (คอม) */}
      <section className="relative m-3 hidden items-center justify-center overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_30%_20%,#fff_0%,transparent_50%),linear-gradient(160deg,#faf7f4_0%,#f5ede2_55%,#e8ddd0_100%)] lg:flex">
        <div className="pointer-events-none absolute top-16 right-16 size-40 rounded-full border-[18px] border-white/70" />
        <div className="pointer-events-none absolute bottom-20 left-14 size-24 rounded-full bg-brand-300/40 blur-xl" />
        <div className="relative flex flex-col items-center gap-10">
          <PhonePreview />
          <div className="max-w-sm text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-brand-900">ลงเวลาง่าย ด้วยมือถือของคุณ</h2>
            <p className="mt-2 text-[15px] text-brand-700">สแกนนิ้วหรือ Face ID พร้อมตรวจพิกัดสาขาอัตโนมัติ ข้อมูลลายนิ้วมือไม่ออกจากเครื่อง</p>
          </div>
        </div>
      </section>
    </main>
  );
}
