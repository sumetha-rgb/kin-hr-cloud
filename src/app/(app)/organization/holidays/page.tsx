import { and, asc, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { holidays } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { FilterBar, StepNav } from "@/components/filter-bar";
import { Card, Field, Flash, Input, Table } from "@/components/ui";
import { bkkDateStr, fmtDate, isoWeekday, WEEKDAY_TH } from "@/lib/time";
import { deleteHoliday, saveHoliday } from "../actions";

export const metadata = { title: "วันหยุด" };

export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ year?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const year = Number(sp.year) || Number(bkkDateStr().slice(0, 4));
  const rows = await db
    .select()
    .from(holidays)
    .where(and(gte(holidays.date, `${year}-01-01`), lte(holidays.date, `${year}-12-31`)))
    .orderBy(asc(holidays.date));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div>
        <Flash ok={sp.ok} error={sp.error} />
        <FilterBar>
          <StepNav label={`ปี ${year + 543}`} prev={`?year=${year - 1}`} next={`?year=${year + 1}`} />
          <span className="px-2 text-sm text-stone-500">
            {rows.length} วัน · กฎหมายกำหนดไม่น้อยกว่า 13 วัน/ปี รวมวันแรงงาน
          </span>
        </FilterBar>
        <Table head={["วันที่", "วัน", "ชื่อวันหยุด", ""]} empty={!rows.length}>
          {rows.map((h) => (
            <tr key={h.id}>
              <td>{fmtDate(h.date)}</td>
              <td>{WEEKDAY_TH[isoWeekday(h.date)]}</td>
              <td>{h.name}</td>
              <td className="text-right">
                <form action={deleteHoliday}>
                  <input type="hidden" name="id" value={h.id} />
                  <SubmitButton variant="ghost" confirm={`ลบวันหยุด ${h.name}?`}>
                    ลบ
                  </SubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <Card title="เพิ่มวันหยุด">
        <form action={saveHoliday} className="space-y-3">
          <Field label="วันที่">
            <Input name="date" type="date" required />
          </Field>
          <Field label="ชื่อวันหยุด">
            <Input name="name" required placeholder="เช่น วันสงกรานต์" />
          </Field>
          <SubmitButton>บันทึก</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
