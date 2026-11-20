/** อ่านจำนวนเงินเป็นตัวอักษรไทย เช่น 1,250.50 → "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์" */
const DIGIT = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const UNIT = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readInt(n: string, higher = false): string {
  // อ่านทีละกลุ่มล้าน
  if (n.length > 6) return readInt(n.slice(0, -6)) + "ล้าน" + readInt(n.slice(-6), true);
  let out = "";
  const len = n.length;
  for (let i = 0; i < len; i++) {
    const d = Number(n[i]);
    const pos = len - i - 1;
    if (d === 0) continue;
    if (pos === 1 && d === 1) out += "สิบ";
    else if (pos === 1 && d === 2) out += "ยี่สิบ";
    else if (pos === 0 && d === 1 && (higher || (len > 1 && Number(n.slice(0, -1)) > 0))) out += "เอ็ด";
    else out += DIGIT[d] + UNIT[pos];
  }
  return out;
}

export function bahtText(amount: number | string): string {
  const v = Math.round(Number(amount) * 100) / 100;
  if (!isFinite(v)) return "";
  if (v === 0) return "ศูนย์บาทถ้วน";
  const [b, s = "00"] = Math.abs(v).toFixed(2).split(".");
  const baht = Number(b) > 0 ? readInt(String(Number(b))) + "บาท" : "";
  const satang = Number(s) > 0 ? readInt(String(Number(s))) + "สตางค์" : "ถ้วน";
  return (v < 0 ? "ลบ" : "") + baht + satang;
}

