import { DocPaper, Letterhead, SignLine } from "@/components/document";
import { bahtText } from "@/lib/bahttext";
import { CERT_LABEL, type CertSnapshot } from "@/lib/certificate";
import { fmtDateLong } from "@/lib/time";
import { cn, fmtMoney, fullName } from "@/lib/util";

/** เลขบัตรประชาชนแบบมีขีด 1-2345-67890-12-3 */
const fmtId = (v: string | null) => (v && v.length === 13 ? `${v[0]}-${v.slice(1, 5)}-${v.slice(5, 10)}-${v.slice(10, 12)}-${v[12]}` : (v ?? "-"));

/**
 * ตัวหนังสือรับรอง (ใช้ทั้งฉบับจริงและตัวอย่าง)
 * preview = ข้อความลายน้ำ "ตัวอย่าง" และยังไม่มีเลขที่หนังสือ
 */
export function CertificateBody({
  company,
  e,
  pos,
  dept,
  kind,
  purpose,
  docNo,
  issued,
  signerName,
  preview,
  className,
}: {
  company: { name: string; address: string | null; taxId: string | null };
  e: CertSnapshot["e"];
  pos: string | null;
  dept: string | null;
  kind: "employment" | "salary";
  purpose: string | null;
  docNo: string | null;
  issued: Date | string;
  signerName?: string;
  preview?: string;
  className?: string;
}) {
  const issuedStr = typeof issued === "string" ? issued : issued.toISOString().slice(0, 10);
  const stillWorking = !e.endDate || e.endDate >= issuedStr;
  const statusText = e.status === "probation" ? "พนักงานทดลองงาน" : "พนักงานประจำ";
  const monthly = e.payType === "monthly";
  // ข้อมูลไม่ครบ: ตัวอย่าง = ป้ายแดงเตือน · ฉบับจริง = เส้นว่างให้เติมด้วยมือ (ไม่พิมพ์ป้ายแดงลงเอกสาร)
  const missing = (v: React.ReactNode, ok: boolean) =>
    ok ? v : preview ? <span className="rounded bg-rose-100 px-1 text-rose-700">ยังไม่ได้กรอก</span> : <span className="inline-block w-40 border-b border-dotted border-stone-500 align-bottom" />;

  return (
    <DocPaper className={className}>
      {preview && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-[28deg] rounded-xl border-[6px] border-brand-500/25 px-10 py-2 text-6xl font-bold tracking-widest text-brand-500/25">{preview}</span>
        </div>
      )}
      <Letterhead company={company} />
      <div className="mt-4 flex justify-between">
        <p>เลขที่ {docNo ?? <span className="text-stone-400">(ออกเมื่ออนุมัติ)</span>}</p>
        <p>วันที่ {fmtDateLong(issued)}</p>
      </div>
      <h1 className="mt-6 text-center text-[22px] font-bold tracking-wide">{CERT_LABEL[kind]}</h1>

      <div className="mt-6 space-y-3 text-justify [&>p]:indent-[2.5em]">
        <p>
          หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <b>{fullName(e)}</b> เลขประจำตัวประชาชน {missing(fmtId(e.nationalId), !!e.nationalId)} เป็น{statusText}ของ{company.name}{" "}
          {stillWorking ? `ตั้งแต่วันที่ ${fmtDateLong(e.startDate)} จนถึงปัจจุบัน` : `ตั้งแต่วันที่ ${fmtDateLong(e.startDate)} ถึงวันที่ ${fmtDateLong(e.endDate)}`}{" "}
          {pos ? `ดำรงตำแหน่ง ${pos}` : ""}
          {dept ? ` สังกัด${dept}` : ""}
        </p>
        {kind === "salary" && (
          <p>
            ปัจจุบันได้รับ{monthly ? "เงินเดือน" : "ค่าจ้างรายวัน"}ในอัตรา{monthly ? "เดือนละ" : "วันละ"}{" "}
            {missing(`${fmtMoney(e.baseSalary)} บาท (${bahtText(e.baseSalary)})`, Number(e.baseSalary) > 0)}
            {Number(e.monthlyAllowance) > 0 && ` และเงินเพิ่มประจำเดือนละ ${fmtMoney(e.monthlyAllowance)} บาท (${bahtText(e.monthlyAllowance)})`}
          </p>
        )}
        <p>ออกให้ไว้เพื่อใช้ประกอบการ{purpose ? purpose.replace(/^เพื่อ/, "") : <span className={cn("text-stone-400")}> (ตามที่ระบุในคำขอ)</span>} ตามที่พนักงานร้องขอ</p>
        <p>ให้ไว้ ณ วันที่ {fmtDateLong(issued)}</p>
      </div>

      <div className="mt-16 flex justify-end">
        <SignLine role="" name={signerName} sub="ผู้จัดการฝ่ายบุคคล" />
      </div>
      <p className="mt-10 text-[12px] text-stone-500">ตรวจสอบความถูกต้องของเอกสารได้ที่ฝ่ายบุคคล{company.address ? ` · ${company.address}` : ""}</p>
    </DocPaper>
  );
}
