"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { companySettings, contractTemplates, employees, employmentContracts } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/payroll-run";
import { fullName, withMsg } from "@/lib/util";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const fail = (p: string, error: string): never => redirect(withMsg(p, { error }));

/** อายุเต็มปี ณ วันที่ */
function ageAt(birth: string | null, on: string) {
  if (!birth) return "";
  let a = Number(on.slice(0, 4)) - Number(birth.slice(0, 4));
  if (on.slice(5) < birth.slice(5)) a--;
  return String(a);
}

/** อ่านรายการค่าจ้างจากฟอร์ม (label_x[] / amount_x[]) — ข้ามแถวที่ไม่มีชื่อ */
function payRows(fd: FormData, prefix: string) {
  const labels = fd.getAll(`${prefix}Label`).map(String);
  const amounts = fd.getAll(`${prefix}Amount`).map((v) => Number(String(v).replace(/,/g, "")) || 0);
  return labels.map((label, i) => ({ label: label.trim(), amount: Math.max(0, amounts[i] ?? 0) })).filter((r) => r.label);
}

export async function createContract(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const employeeId = Number(fd.get("employeeId"));
  const templateId = Number(fd.get("templateId"));
  const back = `/contracts/new?employee=${employeeId}&template=${templateId}`;
  const [[e], [t]] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, employeeId)),
    db.select().from(contractTemplates).where(eq(contractTemplates.id, templateId)),
  ]);
  if (!e || !t) return fail("/contracts/new", "เลือกพนักงานและแม่แบบสัญญา");
  const contractDate = str(fd, "contractDate");
  const startDate = str(fd, "startDate");
  const kind = fd.get("kind") === "temporary" ? "temporary" : "permanent";
  const endDate = str(fd, "endDate");
  const probationDays = Math.min(365, Math.max(0, Number(fd.get("probationDays")) || 0));
  if (!isDate(contractDate) || !isDate(startDate)) return fail(back, "กรอกวันที่ทำสัญญาและวันเริ่มงาน");
  if (kind === "temporary" && (!isDate(endDate) || endDate < startDate)) return fail(back, "พนักงานชั่วคราว: กรอกวันสิ้นสุดการจ้าง (หลังวันเริ่มงาน)");
  const probationPay = kind === "permanent" ? payRows(fd, "prob") : [];
  const regularPay = payRows(fd, "reg");
  if (!regularPay.some((r) => r.amount > 0)) return fail(back, "กรอกค่าจ้างอย่างน้อย 1 รายการ");

  const [row] = await db
    .insert(employmentContracts)
    .values({
      employeeId,
      templateId,
      contractDate,
      kind,
      probationDays,
      startDate,
      endDate: kind === "temporary" ? endDate : null,
      position: str(fd, "position") || null,
      department: str(fd, "department") || null,
      probationPay,
      regularPay,
      probationConditions: kind === "permanent" ? str(fd, "probationConditions") || null : null,
      regularConditions: str(fd, "regularConditions") || null,
      // เก็บข้อความแม่แบบและข้อมูลลูกจ้าง ณ วันทำสัญญาไว้ตายตัว
      terms: {
        name: t.name,
        docCode: t.docCode,
        workTerms: t.workTerms,
        holidayTerms: t.holidayTerms,
        payUnit: t.payUnit,
        extraClauseTitle: t.extraClauseTitle,
        extraClause: t.extraClause,
      },
      party: {
        name: fullName(e),
        nationalId: e.nationalId,
        birthDate: e.birthDate,
        age: ageAt(e.birthDate, contractDate),
        phone: e.phone,
        address: e.address,
        addrNo: e.addrNo,
        addrMoo: e.addrMoo,
        addrVillage: e.addrVillage,
        addrSoi: e.addrSoi,
        addrRoad: e.addrRoad,
        addrSubdistrict: e.addrSubdistrict,
        addrDistrict: e.addrDistrict,
        addrProvince: e.addrProvince,
        addrZip: e.addrZip,
      },
      signers: {
        employerRep: str(fd, "employerRep") || null,
        employerRepTitle: str(fd, "employerRepTitle") || null,
        hrHead: str(fd, "hrHead") || null,
        witness: str(fd, "witness") || null,
      },
      createdBy: u.id,
    })
    .returning({ id: employmentContracts.id });

  // จำชื่อผู้ลงนามไว้เป็นค่าเริ่มต้นครั้งถัดไป
  await getSettings();
  await db
    .update(companySettings)
    .set({ employerRepName: str(fd, "employerRep") || null, employerRepTitle: str(fd, "employerRepTitle") || null, hrHeadName: str(fd, "hrHead") || null })
    .where(eq(companySettings.id, 1));
  await audit(u.id, "create", "contract", row.id, { employeeId, template: t.name, kind, startDate });
  redirect(withMsg(`/contracts/${row.id}`, { ok: "ออกสัญญาจ้างแล้ว — ตรวจทานแล้วกดพิมพ์ / บันทึก PDF" }));
}

export async function deleteContract(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id"));
  await db.delete(employmentContracts).where(eq(employmentContracts.id, id));
  await audit(u.id, "delete", "contract", id);
  redirect(withMsg("/contracts", { ok: "ลบสัญญาแล้ว" }));
}

export async function saveContractTemplate(fd: FormData) {
  const u = await requireRole("admin", "hr");
  const id = Number(fd.get("id")) || null;
  const P = id ? `/contracts/templates?t=${id}` : "/contracts/templates";
  const name = str(fd, "name");
  if (!name) return fail(P, "ตั้งชื่อแม่แบบ");
  const values = {
    name,
    docCode: str(fd, "docCode") || null,
    probationDays: Math.min(365, Math.max(0, Number(fd.get("probationDays")) || 0)),
    workTerms: str(fd, "workTerms"),
    holidayTerms: str(fd, "holidayTerms"),
    payLabels: str(fd, "payLabels") || "ค่าฐานเงินเดือน",
    payUnit: ["ต่อเดือน", "ต่อเวร", "ต่อวัน"].includes(str(fd, "payUnit")) ? str(fd, "payUnit") : "ต่อเดือน",
    conditions: str(fd, "conditions"),
    extraClauseTitle: str(fd, "extraClauseTitle") || null,
    extraClause: str(fd, "extraClause") || null,
    active: fd.get("active") === "on",
    updatedAt: new Date(),
  };
  let savedId = id;
  if (id) await db.update(contractTemplates).set(values).where(eq(contractTemplates.id, id));
  else savedId = (await db.insert(contractTemplates).values(values).returning({ id: contractTemplates.id }))[0].id;
  await audit(u.id, id ? "update" : "create", "contract_template", savedId ?? undefined, { name });
  redirect(withMsg(`/contracts/templates?t=${savedId}`, { ok: "บันทึกแม่แบบแล้ว (สัญญาที่ออกไปแล้วไม่เปลี่ยนตาม)" }));
}
