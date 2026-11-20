import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { DocPaper, SignLine } from "@/components/document";
import { Icon } from "@/components/icons";
import { PrintButton } from "@/components/print-button";
import { isHR, requireUser } from "@/lib/auth";
import { bahtText } from "@/lib/bahttext";
import { annualTaxSummary, getSettings } from "@/lib/payroll-run";
import { bkkDateStr, fmtDateLong } from "@/lib/time";
import { fmtMoney, fullName } from "@/lib/util";

export const metadata = { title: "หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)" };

/** ช่องกรอกเลข 13 หลักแบบแบ่งกลุ่ม 1-4-5-2-1 ตามแบบฟอร์มกรมสรรพากร */
function IdBoxes({ value }: { value: string | null }) {
  const d = (value ?? "").replace(/\D/g, "").padEnd(13, " ").slice(0, 13).split("");
  const groups = [1, 4, 5, 2, 1];
  let i = 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {groups.map((g, gi) => (
        <span key={gi} className="inline-flex">
          {Array.from({ length: g }, () => d[i++]).map((c, k) => (
            <span key={k} className="-ml-px inline-flex h-6 w-5 items-center justify-center border border-stone-500 text-[13px] first:ml-0">
              {c.trim()}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

export default async function Pnd50Tawi({ params }: { params: Promise<{ year: string; employeeId: string }> }) {
  const u = await requireUser();
  const p = await params;
  const year = Number(p.year);
  const empId = Number(p.employeeId);
  const hr = isHR(u);
  if (!hr && u.employeeId !== empId) notFound();
  const [[e], company, sum] = await Promise.all([db.select().from(employees).where(eq(employees.id, empId)), getSettings(), annualTaxSummary(year, empId)]);
  if (!e) notFound();
  const t = sum.get(empId)?.total ?? { income: 0, sso: 0, tax: 0 };
  const thisYear = Number(bkkDateStr().slice(0, 4));
  const issuedOn = year < thisYear ? `${year + 1}-01-31` : bkkDateStr();

  return (
    <div className="mx-auto max-w-[210mm]">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={hr ? `/payroll/tax?year=${year}` : "/payroll/my"} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
          <Icon name="chevronLeft" className="size-4" />
          {hr ? `ภาษีทั้งปี ${year + 543}` : "สลิปเงินเดือนของฉัน"}
        </Link>
        <PrintButton />
      </div>
      {year === thisYear && (
        <p className="no-print mb-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
          ปีภาษีนี้ยังไม่จบ ยอดในเอกสารเป็นยอดสะสมถึงงวดล่าสุดที่ปิดแล้ว — ฉบับจริงควรออกหลังปิดงวดธันวาคม
        </p>
      )}

      <DocPaper className="text-[14px] leading-[1.7]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px]">ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)</p>
          <p className="shrink-0 text-[13px]">
            เล่มที่ {year + 543} เลขที่ {String(empId).padStart(5, "0")}
          </p>
        </div>
        <h1 className="mt-3 text-center text-[20px] font-bold">หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1>
        <p className="text-center text-[13px]">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</p>

        <section className="mt-4 border border-stone-500 px-4 py-3">
          <p className="font-semibold">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</p>
          <p className="mt-1">
            ชื่อ {company.name}
            <span className="float-right">
              เลขประจำตัวผู้เสียภาษีอากร <IdBoxes value={company.taxId} />
            </span>
          </p>
          <p className="clear-both">ที่อยู่ {company.address ?? "-"}</p>
        </section>

        <section className="mt-2 border border-stone-500 px-4 py-3">
          <p className="font-semibold">ผู้ถูกหักภาษี ณ ที่จ่าย</p>
          <p className="mt-1">
            ชื่อ {fullName(e)}
            <span className="float-right">
              เลขประจำตัวผู้เสียภาษีอากร <IdBoxes value={e.nationalId} />
            </span>
          </p>
          <p className="clear-both">ที่อยู่ {e.address ?? "-"}</p>
          <p className="mt-1 text-[13px]">ลำดับที่ {String(empId).padStart(5, "0")} ในแบบ ภ.ง.ด.1ก</p>
        </section>

        <table className="mt-2 w-full border-collapse border border-stone-500 text-[13.5px] [&_td]:border [&_td]:border-stone-500 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-stone-500 [&_th]:px-2 [&_th]:py-1.5">
          <thead>
            <tr className="bg-stone-100">
              <th className="text-left font-semibold">ประเภทเงินได้พึงประเมินที่จ่าย</th>
              <th className="w-28 font-semibold">ปีภาษีที่จ่าย</th>
              <th className="w-32 font-semibold">จำนวนเงินที่จ่าย</th>
              <th className="w-32 font-semibold">ภาษีที่หักและนำส่งไว้</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)</td>
              <td className="text-center">{year + 543}</td>
              <td className="text-right tabular-nums">{fmtMoney(t.income)}</td>
              <td className="text-right tabular-nums">{fmtMoney(t.tax)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={2} className="text-right">
                รวมเงินที่จ่ายและภาษีที่หักนำส่ง
              </td>
              <td className="text-right tabular-nums">{fmtMoney(t.income)}</td>
              <td className="text-right tabular-nums">{fmtMoney(t.tax)}</td>
            </tr>
            <tr>
              <td colSpan={4}>รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) &nbsp;({bahtText(Number(t.tax))})</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-2">เงินที่จ่ายเข้า กองทุนประกันสังคม {fmtMoney(t.sso)} บาท</p>
        <p>
          ผู้จ่ายเงิน <span className="mx-1 inline-flex size-4 items-center justify-center border border-stone-600 align-middle text-[11px]">✓</span> (1) หัก ณ ที่จ่าย
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <p className="text-[13px] text-stone-700">ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</p>
          <SignLine role="ผู้จ่ายเงิน" sub={`วันที่ ${fmtDateLong(issuedOn)}`} />
        </div>
      </DocPaper>
    </div>
  );
}
