import { desc } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { Flash, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { EmployeeForm } from "../employee-form";

export const metadata = { title: "เพิ่มพนักงาน" };

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const [last] = await db.select({ code: employees.code }).from(employees).orderBy(desc(employees.id)).limit(1);
  const m = last?.code.match(/^(.*?)(\d+)$/);
  const suggestedCode = m ? `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, "0")}` : "E0001";
  return (
    <>
      <PageHeader title="เพิ่มพนักงาน" />
      <Flash error={sp.error} />
      <EmployeeForm suggestedCode={suggestedCode} />
    </>
  );
}
