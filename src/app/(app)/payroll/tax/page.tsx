import { asc, ne, or, gte } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { StepNav } from "@/components/filter-bar";
import { Card, Flash, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { annualTaxSummary } from "@/lib/payroll-run";
import { bkkDateStr } from "@/lib/time";
import { fmtMoney, fullName } from "@/lib/util";
import { saveOpenings } from "../actions";

export const metadata = { title: "ภาษีทั้งปี" };

const cell = "w-full min-w-0 rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums focus:border-brand-400 focus:outline-none";

export default async function TaxYearPage({ searchParams }: { searchParams: Promise<{ year?: string; ok?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const year = Number(sp.year) || Number(bkkDateStr().slice(0, 4));
  const [emps, sum] = await Promise.all([
    db
      .select()
      .from(employees)
      .where(or(ne(employees.status, "resigned"), gte(employees.endDate, `${year}-01-01`)))
      .orderBy(asc(employees.code)),
    annualTaxSummary(year),
  ]);
  const totals = [...sum.values()].reduce((a, v) => ({ income: a.income + Number(v.total.income), tax: a.tax + Number(v.total.tax) }), { income: 0, tax: 0 });

  return (
    <>
      <PageHeader
        title={`ภาษีทั้งปี ${year + 543}`}
        subtitle="ยอดยกมาก่อนใช้ระบบ · เงินได้และภาษีสะสม · พิมพ์หนังสือรับรองการหักภาษี (50 ทวิ)"
        actions={<StepNav prev={`?year=${year - 1}`} next={`?year=${year + 1}`} label={`ปี ${year + 543}`} />}
      />
      <Flash ok={sp.ok} error={sp.error} />

      <Card className="mb-5" title="ระบบหักภาษีอย่างไร">
        <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600">
          <li>
            คิดภาษีตาม<b>ขั้นบันไดของกรมสรรพากร</b> (150,000 แรกยกเว้น, ถัดไป 5% 10% 15% … ถึง 35%) หลังหักค่าใช้จ่าย 50% (ไม่เกิน 100,000) ลดหย่อนส่วนตัว 60,000 ประกันสังคม
            และค่าลดหย่อนอื่นที่กรอกในข้อมูลพนักงาน
          </li>
          <li>
            หักแบบ<b>สะสมทั้งปี</b>: ทุกเดือนประมาณเงินได้ทั้งปีจากยอดที่จ่ายจริงไปแล้ว + เดือนนี้ × เดือนที่เหลือ แล้วเฉลี่ยภาษีที่ยังขาดไปเดือนที่เหลือ — เดือนธันวาคมยอดหักรวมจะเท่าภาษีจริงพอดี
          </li>
          <li>
            คนที่ระบบยังไม่รู้เงินได้ครบทุกเดือนของปี (เช่น เริ่มใช้ระบบกลางปี) จะใช้วิธีประมาณ × 12 ไปก่อน — <b>กรอก &ldquo;ยอดยกมา&rdquo; ด้านล่าง</b>{" "}
            (เงินได้/ประกันสังคม/ภาษีที่หักไปแล้วในปีนี้ก่อนใช้ระบบ) แล้วกด &ldquo;คำนวณใหม่&rdquo; ในงวดที่ยังไม่ปิด
          </li>
        </ul>
      </Card>

      <form action={saveOpenings}>
        <input type="hidden" name="year" value={year} />
        <div className="overflow-hidden rounded-3xl border border-brand-200/80 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 px-4 py-3 sm:px-5">
            <p className="text-sm text-stone-600">
              รวมทั้งปี: เงินได้ <b className="tabular-nums text-brand-900">{fmtMoney(totals.income)}</b> · ภาษีหักแล้ว{" "}
              <b className="tabular-nums text-brand-900">{fmtMoney(totals.tax)}</b>
            </p>
            <SubmitButton>บันทึกยอดยกมา</SubmitButton>
          </div>
          <div className="divide-y divide-brand-100">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)_auto] gap-3 bg-brand-50/60 px-5 py-2 text-xs font-medium text-brand-700 lg:grid">
              <span>พนักงาน</span>
              <span className="text-right">ยอดยกมา: เงินได้</span>
              <span className="text-right">ประกันสังคม</span>
              <span className="text-right">ภาษีที่หักแล้ว</span>
              <span className="text-right">รวมทั้งปี (เงินได้ / ภาษี)</span>
              <span className="w-20" />
            </div>
            {emps.map((e) => {
              const s = sum.get(e.id);
              const o = s?.opening;
              const v = (x: string | undefined) => (x && Number(x) ? x : "");
              return (
                <div
                  key={e.id}
                  className="grid gap-2 px-4 py-3 sm:px-5 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)_auto] lg:items-center lg:gap-3"
                >
                  <input type="hidden" name="emp" value={e.id} />
                  <div className="min-w-0">
                    <span className="block truncate font-medium text-brand-900">{fullName(e)}</span>
                    <span className="text-xs text-stone-500">
                      {e.code} · ในระบบ {s?.inSystem.months ?? 0} เดือน
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 lg:contents">
                    <label className="text-[11px] text-stone-500 lg:contents">
                      <span className="lg:hidden">เงินได้ยกมา</span>
                      <input name={`income_${e.id}`} inputMode="decimal" defaultValue={v(o?.income)} placeholder="0" className={cell} />
                    </label>
                    <label className="text-[11px] text-stone-500 lg:contents">
                      <span className="lg:hidden">ประกันสังคม</span>
                      <input name={`sso_${e.id}`} inputMode="decimal" defaultValue={v(o?.sso)} placeholder="0" className={cell} />
                    </label>
                    <label className="text-[11px] text-stone-500 lg:contents">
                      <span className="lg:hidden">ภาษีหักแล้ว</span>
                      <input name={`tax_${e.id}`} inputMode="decimal" defaultValue={v(o?.tax)} placeholder="0" className={cell} />
                    </label>
                  </div>
                  <div className="flex items-center justify-between text-sm tabular-nums lg:block lg:text-right">
                    <span className="text-xs text-stone-500 lg:hidden">รวมทั้งปี</span>
                    <span>
                      {fmtMoney(s?.total.income ?? 0)} <span className="text-stone-400">/</span> <b className="text-brand-900">{fmtMoney(s?.total.tax ?? 0)}</b>
                    </span>
                  </div>
                  <Link
                    href={`/payroll/tax/${year}/${e.id}`}
                    className="inline-flex w-20 items-center justify-center gap-1 justify-self-start rounded-full border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 lg:justify-self-end"
                  >
                    <Icon name="printer" className="size-3.5" />
                    50 ทวิ
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </form>
    </>
  );
}
