import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { certificateRequests, departments, employees, positions, users } from "@/db/schema";
import { getSettings } from "./payroll-run";
import { fullName } from "./util";

/** ชื่อเอกสารรับรอง */
export const CERT_LABEL = { employment: "หนังสือรับรองการทำงาน", salary: "หนังสือรับรองเงินเดือน" } as const;

export type CertSnapshot = NonNullable<(typeof certificateRequests.$inferSelect)["snapshot"]>;

/**
 * เก็บข้อมูลที่หนังสือใช้ ณ ตอนนี้ (เรียกตอนออกหนังสือ)
 * signerUserId = ผู้อนุมัติ ใช้ชื่อพนักงานที่ผูกกับบัญชีนั้นเป็นผู้ลงนาม
 */
export async function buildCertSnapshot(employeeId: number, signerUserId: number | null): Promise<CertSnapshot | null> {
  const signer = alias(employees, "signer");
  const [[row], company, signerRow] = await Promise.all([
    db
      .select({ e: employees, pos: positions.name, dept: departments.name })
      .from(employees)
      .leftJoin(positions, eq(employees.positionId, positions.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(employees.id, employeeId)),
    getSettings(),
    signerUserId
      ? db
          .select({ s: signer })
          .from(users)
          .innerJoin(signer, eq(users.employeeId, signer.id))
          .where(eq(users.id, signerUserId))
          .then((r) => r[0])
      : Promise.resolve(undefined),
  ]);
  if (!row) return null;
  const { e } = row;
  return {
    e: {
      prefix: e.prefix,
      firstName: e.firstName,
      lastName: e.lastName,
      nationalId: e.nationalId,
      status: e.status,
      startDate: e.startDate,
      endDate: e.endDate,
      payType: e.payType,
      baseSalary: e.baseSalary,
      monthlyAllowance: e.monthlyAllowance,
    },
    pos: row.pos,
    dept: row.dept,
    company: { name: company.name, address: company.address, taxId: company.taxId },
    signerName: signerRow ? fullName(signerRow.s) : null,
  };
}
