import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { employmentContracts } from "@/db/schema";
import { Icon } from "@/components/icons";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "@/components/ui";
import { isHR, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/payroll-run";
import { cn } from "@/lib/util";
import { deleteContract } from "../actions";
import { ContractDocument } from "../contract-doc";

export const metadata = { title: "สัญญาจ้าง" };

const COPIES = {
  both: ["ต้นฉบับ", "สำเนา"],
  original: ["ต้นฉบับ"],
  copy: ["สำเนา"],
} as const;

export default async function ContractView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; copies?: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const sp = await searchParams;
  const [c] = await db.select().from(employmentContracts).where(eq(employmentContracts.id, id));
  const hr = isHR(u);
  // HR เห็นทุกฉบับ · พนักงานเห็นสัญญาของตัวเอง
  if (!c || (!hr && c.employeeId !== u.employeeId)) notFound();
  const company = await getSettings();
  const which = (sp.copies && sp.copies in COPIES ? sp.copies : "both") as keyof typeof COPIES;

  return (
    <div className="mx-auto max-w-[210mm]">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={hr ? "/contracts" : "/account"} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
          <Icon name="chevronLeft" className="size-4" />
          {hr ? "สัญญาจ้างทั้งหมด" : "โปรไฟล์ของฉัน"}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-brand-200 bg-white p-0.5 text-sm">
            {(
              [
                ["both", "ต้นฉบับ + สำเนา"],
                ["original", "ต้นฉบับ"],
                ["copy", "สำเนา"],
              ] as const
            ).map(([k, label]) => (
              <Link key={k} href={`?copies=${k}`} className={cn("rounded-full px-3 py-1.5", which === k ? "bg-brand-900 font-medium text-white" : "text-stone-600 hover:text-brand-900")}>
                {label}
              </Link>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>
      <div className="no-print">
        <Flash ok={sp.ok} />
      </div>

      <ContractDocument c={c} company={company} copies={[...COPIES[which]]} />

      {hr && (
        <form action={deleteContract} className="no-print mt-6 flex justify-end">
          <input type="hidden" name="id" value={c.id} />
          <SubmitButton variant="ghost" confirm="ลบสัญญาฉบับนี้? (ใช้กรณีออกผิด — สัญญาที่ลงนามแล้วควรเก็บไว้)">
            ลบสัญญาฉบับนี้
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
