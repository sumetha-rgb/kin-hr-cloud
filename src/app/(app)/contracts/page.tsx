import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { employees, employmentContracts } from "@/db/schema";
import { Badge, Flash, LinkButton, PageHeader, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/time";
import { fullName } from "@/lib/util";

export const metadata = { title: "สัญญาจ้าง" };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const rows = await db
    .select({ c: employmentContracts, e: employees })
    .from(employmentContracts)
    .innerJoin(employees, eq(employmentContracts.employeeId, employees.id))
    .orderBy(desc(employmentContracts.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        title="สัญญาจ้าง"
        subtitle="ออกสัญญาจ้างพนักงานตามแม่แบบของแต่ละตำแหน่ง · ดึงข้อมูลพนักงานใส่ให้อัตโนมัติ · พิมพ์ต้นฉบับและสำเนา"
        actions={
          <>
            <LinkButton href="/contracts/templates" variant="secondary">
              แม่แบบสัญญา
            </LinkButton>
            <LinkButton href="/contracts/new">+ ออกสัญญาจ้าง</LinkButton>
          </>
        }
      />
      <Flash ok={sp.ok} error={sp.error} />
      <Table head={["วันที่ทำสัญญา", "พนักงาน", "แม่แบบ", "ตำแหน่ง", "ประเภท", "เริ่มงาน"]} empty={!rows.length}>
        {rows.map(({ c, e }) => (
          <tr key={c.id} data-href={`/contracts/${c.id}`}>
            <td className="whitespace-nowrap">{fmtDate(c.contractDate)}</td>
            <td>
              <Link href={`/contracts/${c.id}`} className="block font-medium text-brand-900">
                {fullName(e)}
              </Link>
              <span className="text-xs text-stone-500">{e.code}</span>
            </td>
            <td>{c.terms.name}</td>
            <td className="text-stone-600">{c.position ?? "-"}</td>
            <td>{c.kind === "permanent" ? <Badge tone="green">ประจำ · ทดลองงาน {c.probationDays} วัน</Badge> : <Badge tone="amber">ชั่วคราว</Badge>}</td>
            <td className="whitespace-nowrap">{fmtDate(c.startDate)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
