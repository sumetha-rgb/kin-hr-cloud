/* eslint-disable @next/next/no-img-element */
import { Sarabun } from "next/font/google";
import { cn } from "@/lib/util";

// ฟอนต์เอกสารทางการ (สารบรรณ) — ใช้กับหนังสือรับรอง / 50 ทวิ
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "600", "700"], display: "swap" });

/** กระดาษ A4 สำหรับเอกสารทางการ (ส่วนที่พิมพ์) */
export function DocPaper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        sarabun.className,
        "relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white px-6 py-8 text-[15px] leading-[1.9] text-stone-900 shadow-lift ring-1 ring-stone-200 sm:px-[18mm] sm:py-[16mm] print:max-w-none print:p-0 print:text-[14.5px] print:leading-[1.7] print:shadow-none print:ring-0",
        className,
      )}
    >
      {children}
    </article>
  );
}

/** หัวกระดาษบริษัท */
export function Letterhead({ company }: { company: { name: string; address: string | null; taxId: string | null } }) {
  return (
    <header className="flex items-center gap-4 border-b-2 border-stone-800 pb-4">
      <img src="/kin-logo.png" alt="" width={64} height={64} className="shrink-0" />
      <div className="min-w-0 leading-snug">
        <p className="text-[17px] font-bold">{company.name}</p>
        {company.address && <p className="text-[13px] text-stone-700">{company.address}</p>}
        {company.taxId && <p className="text-[13px] text-stone-700">เลขประจำตัวผู้เสียภาษี {company.taxId}</p>}
      </div>
    </header>
  );
}

/** ช่องลงลายมือชื่อแบบเส้นประ */
export function SignLine({ role, name, sub }: { role: string; name?: string; sub?: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="whitespace-nowrap">
        ลงชื่อ <span className="inline-block w-44 border-b border-dotted border-stone-500 align-bottom" /> {role}
      </p>
      <p className="mt-1.5">( {name ?? <span className="inline-block w-40 border-b border-dotted border-stone-500 align-bottom" />} )</p>
      {sub && <div className="mt-1 text-[13px] text-stone-600">{sub}</div>}
    </div>
  );
}
