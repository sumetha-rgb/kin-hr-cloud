import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl font-bold text-stone-300">404</div>
      <p className="text-stone-600">ไม่พบหน้าที่ต้องการ</p>
      <Link href="/" className="text-brand-600 underline">
        กลับหน้าหลัก
      </Link>
    </main>
  );
}
