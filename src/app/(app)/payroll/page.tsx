import { count, desc, eq, sum } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { payrollItems, payrollRuns } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Flash, Input, PageHeader, Select, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { bkkDateStr, fmtDateTime, fmtMonth } from "@/lib/time";
import { fmtMoney } from "@/lib/util";
import { createRun } from "./actions";

export const metadata = { title: "Payroll" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireRole("admin", "hr");
  const sp = await searchParams;
  const runs = await db
    .select({ run: payrollRuns, n: count(payrollItems.id), net: sum(payrollItems.net), gross: sum(payrollItems.gross) })
    .from(payrollRuns)
    .leftJoin(payrollItems, eq(payrollItems.runId, payrollRuns.id))
    .groupBy(payrollRuns.id)
    .orderBy(desc(payrollRuns.year), desc(payrollRuns.month));
  const [y, m] = bkkDateStr().split("-").map(Number);

  return (
    <>
      <PageHeader title="Payroll" subtitle="ระบบคำนวณเงินเดือนอัตโนมัติ" />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Table head={["งวด", "จำนวนคน", "รายได้รวม", "จ่ายสุทธิ", "สถานะ", "คำนวณล่าสุด"]} empty={!runs.length}>
          {runs.map(({ run, n, net, gross }) => (
            <tr key={run.id} className="hover:bg-stone-50">
              <td>
                <Link href={`/payroll/${run.id}`} className="font-medium text-brand-600">
                  {fmtMonth(run.year, run.month)}
                </Link>
              </td>
              <td>{n}</td>
              <td className="tabular-nums">{fmtMoney(gross)}</td>
              <td className="font-medium tabular-nums">{fmtMoney(net)}</td>
              <td>{run.status === "finalized" ? <Badge tone="green">ปิดงวดแล้ว</Badge> : <Badge tone="amber">ฉบับร่าง</Badge>}</td>
              <td className="text-stone-500">{fmtDateTime(run.calculatedAt)}</td>
            </tr>
          ))}
        </Table>
        <Card title="สร้างงวดเงินเดือน">
          <form action={createRun} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="เดือน">
                <Select name="month" defaultValue={m} options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: fmtMonth(y, i + 1).split(" ")[0] }))} />
              </Field>
              <Field label="ปี (ค.ศ.)">
                <Input name="year" type="number" defaultValue={y} />
              </Field>
            </div>
            <SubmitButton>คำนวณเงินเดือน</SubmitButton>
            <p className="text-xs text-stone-500">
              ระบบดึงเวลาทำงาน ขาด/สาย ใบลาที่อนุมัติ และ OT ที่อนุมัติ มาคำนวณ พร้อมหักประกันสังคมและภาษี ณ ที่จ่ายอัตโนมัติ คำนวณซ้ำได้จนกว่าจะปิดงวด
            </p>
          </form>
        </Card>
      </div>
    </>
  );
}
