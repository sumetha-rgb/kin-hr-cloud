import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const D = (v: Decimal.Value) => new Decimal(v || 0);
const r2 = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** ประกันสังคม: อัตรา% × ค่าจ้าง (ถูกจำกัดด้วยฐานต่ำสุด/สูงสุด) ปัดเป็นบาท */
export function calcSso(wage: Decimal.Value, ratePct: Decimal.Value, minBase: Decimal.Value, maxBase: Decimal.Value): Decimal {
  const w = D(wage);
  if (w.lte(0)) return D(0);
  let base = Decimal.max(w, D(minBase));
  if (D(maxBase).gt(0)) base = Decimal.min(base, D(maxBase));
  return base.mul(D(ratePct)).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/** อัตราภาษีเงินได้บุคคลธรรมดาแบบขั้นบันได (เงินได้สุทธิต่อปี) */
const PIT_BRACKETS: Array<[number, number]> = [
  [150_000, 0],
  [300_000, 0.05],
  [500_000, 0.1],
  [750_000, 0.15],
  [1_000_000, 0.2],
  [2_000_000, 0.25],
  [5_000_000, 0.3],
  [Infinity, 0.35],
];

export function annualPit(netIncome: Decimal.Value): Decimal {
  let remaining = D(netIncome);
  let prev = 0;
  let tax = D(0);
  for (const [cap, rate] of PIT_BRACKETS) {
    if (remaining.lte(0)) break;
    const width = cap === Infinity ? remaining : Decimal.min(remaining, D(cap - prev));
    tax = tax.plus(width.mul(rate));
    remaining = remaining.minus(width);
    prev = cap;
  }
  return r2(tax);
}

/**
 * ภาษีหัก ณ ที่จ่ายรายเดือน (ภ.ง.ด.1) วิธีประมาณการทั้งปี:
 * เงินได้ต่อเดือน × 12 − ค่าใช้จ่าย 50% (ไม่เกิน 100,000) − ลดหย่อนส่วนตัว 60,000 − ประกันสังคมทั้งปี − ลดหย่อนอื่น
 */
export function monthlyWithholding(monthlyTaxable: Decimal.Value, monthlySso: Decimal.Value, extraAnnualAllowance: Decimal.Value = 0): Decimal {
  const annual = D(monthlyTaxable).mul(12);
  if (annual.lte(0)) return D(0);
  const expense = Decimal.min(annual.mul(0.5), 100_000);
  const net = annual.minus(expense).minus(60_000).minus(D(monthlySso).mul(12)).minus(D(extraAnnualAllowance));
  return r2(annualPit(Decimal.max(net, 0)).div(12));
}

/** ภาษีทั้งปีจากเงินได้ทั้งปี (หักค่าใช้จ่าย/ลดหย่อน แล้วคิดตามขั้นบันได) */
export function annualTaxOf(annualIncome: Decimal.Value, annualSso: Decimal.Value, extraAnnualAllowance: Decimal.Value = 0) {
  const annual = D(annualIncome);
  const expense = Decimal.min(annual.mul(0.5), 100_000);
  const net = Decimal.max(annual.minus(expense).minus(60_000).minus(D(annualSso)).minus(D(extraAnnualAllowance)), 0);
  return { annual, expense, net, tax: annualPit(net) };
}

/** ยอดสะสมตั้งแต่ต้นปีถึงเดือนก่อน (จากงวดที่ปิดแล้ว) */
export type Ytd = { taxable: Decimal.Value; sso: Decimal.Value; tax: Decimal.Value };

/**
 * ภาษีหัก ณ ที่จ่ายแบบ "สะสมทั้งปี" (ปรับยอดทุกเดือน และตรงพอดีในเดือนธันวาคม):
 *   เงินได้ทั้งปี(ประมาณ) = เงินได้สะสมถึงเดือนก่อน + เงินได้เดือนนี้ × จำนวนเดือนที่เหลือ (รวมเดือนนี้)
 *   ภาษีเดือนนี้ = (ภาษีทั้งปี − ภาษีที่หักไปแล้ว) ÷ จำนวนเดือนที่เหลือ
 * เดือนไหนได้ OT มาก ภาษีจะเฉลี่ยไปเดือนที่เหลือ ไม่กระโดดทีเดียว และเดือน 12 จะหักส่วนที่ขาด/คืนส่วนที่เกินให้พอดีภาษีจริง
 */
export function cumulativeWithholding(o: { month: number; taxable: Decimal.Value; sso: Decimal.Value; extraAnnualAllowance?: Decimal.Value; ytd?: Ytd }): Decimal {
  const remaining = 13 - o.month;
  const ytd = o.ytd ?? { taxable: 0, sso: 0, tax: 0 };
  const income = D(ytd.taxable).plus(D(o.taxable).mul(remaining));
  if (income.lte(0)) return D(0);
  const sso = D(ytd.sso).plus(D(o.sso).mul(remaining));
  const { tax } = annualTaxOf(income, sso, o.extraAnnualAllowance ?? 0);
  // ไม่ติดลบ: ถ้าหักเกินมาแล้ว เดือนนี้หัก 0 (ส่วนเกินขอคืนตอนยื่น ภ.ง.ด.91)
  return r2(Decimal.max(tax.minus(D(ytd.tax)), 0).div(remaining));
}

export type PayInput = {
  payType: "monthly" | "daily";
  baseSalary: Decimal.Value;
  daysInMonth: number;
  employedCalendarDays: number;
  workedDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  paidHolidays: number;
  lateMinutes: number;
  otUnits: Decimal.Value; // ผลรวม ชั่วโมง × อัตรา (เช่น 2 ชม. × 1.5 = 3)
  allowance: Decimal.Value;
  otherIncome: Decimal.Value;
  otherDeduction: Decimal.Value;
  ssoEnabled: boolean;
  ssoRate: Decimal.Value;
  ssoMinBase: Decimal.Value;
  ssoMaxBase: Decimal.Value;
  /** ไม่ใช้แล้ว — มาสายไม่หักเงิน */
  deductLate?: boolean;
  extraTaxAllowance: Decimal.Value;
  /** เดือนของงวด (1-12) และยอดสะสมต้นปี — ถ้าไม่ส่งมาใช้วิธีประมาณ × 12 แบบเดิม */
  month?: number;
  ytd?: Ytd;
};

export function calcPay(i: PayInput) {
  const base = D(i.baseSalary);
  let earned: Decimal;
  let hourly: Decimal;
  if (i.payType === "monthly") {
    const daily = base.div(30);
    hourly = daily.div(8);
    const fullMonth = i.employedCalendarDays >= i.daysInMonth;
    earned = fullMonth ? base : daily.mul(i.employedCalendarDays);
    earned = earned.minus(daily.mul(i.absentDays + i.unpaidLeaveDays));
  } else {
    hourly = base.div(8);
    earned = base.mul(i.workedDays + i.paidLeaveDays + i.paidHolidays);
  }
  earned = r2(Decimal.max(earned, 0));
  const otAmount = r2(hourly.mul(D(i.otUnits)));
  // นโยบายบริษัท: มาสาย "ไม่หักเงิน" เด็ดขาด (บันทึกนาทีที่สายไว้ดูวินัยเท่านั้น)
  const lateDeduction = D(0);
  const allowance = r2(D(i.allowance));
  const otherIncome = r2(D(i.otherIncome));
  const otherDeduction = r2(D(i.otherDeduction));
  const gross = earned.plus(otAmount).plus(allowance).plus(otherIncome);
  const sso = i.ssoEnabled ? calcSso(Decimal.max(earned.minus(lateDeduction), 0), i.ssoRate, i.ssoMinBase, i.ssoMaxBase) : D(0);
  const taxable = Decimal.max(gross.minus(lateDeduction), 0);
  const tax = i.month
    ? cumulativeWithholding({ month: i.month, taxable, sso, extraAnnualAllowance: i.extraTaxAllowance, ytd: i.ytd })
    : monthlyWithholding(taxable, sso, i.extraTaxAllowance);
  const net = gross.minus(lateDeduction).minus(sso).minus(tax).minus(otherDeduction);
  const s = (v: Decimal) => v.toFixed(2);
  return {
    earnedSalary: s(earned),
    otAmount: s(otAmount),
    allowance: s(allowance),
    otherIncome: s(otherIncome),
    lateDeduction: s(lateDeduction),
    sso: s(sso),
    tax: s(tax),
    otherDeduction: s(otherDeduction),
    gross: s(gross),
    net: s(net),
  };
}
