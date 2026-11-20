import { asc } from "drizzle-orm";
import { db } from "@/db";
import { leaveTypes } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { Card, Checkbox, Field, Flash, Input, Select, Tabs, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { bkkDateStr } from "@/lib/time";
import { createRequest } from "../actions";

export const metadata = { title: "ยื่นคำขอ" };

export default async function NewRequest({ searchParams }: { searchParams: Promise<{ type?: string; error?: string; date?: string; kind?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  if (!u.employeeId) return <p className="text-stone-500">บัญชีนี้ไม่ได้ผูกกับพนักงาน</p>;
  const type = sp.type === "ot" || sp.type === "time_correction" ? sp.type : "leave";
  const lts = await db.select().from(leaveTypes).orderBy(asc(leaveTypes.id));
  const today = bkkDateStr();

  return (
    <div className="max-w-xl">
      <Tabs
        active={type}
        items={[
          { key: "leave", href: "?type=leave", label: "ลางาน" },
          { key: "ot", href: "?type=ot", label: "ขอทำ OT" },
          { key: "time_correction", href: "?type=time_correction", label: "ขอแก้ไขเวลา" },
        ]}
      />
      <Flash error={sp.error} />
      <Card>
        <form action={createRequest} className="space-y-3">
          <input type="hidden" name="type" value={type} />
          {type === "leave" && (
            <>
              <Field label="ประเภทการลา">
                <Select name="leaveTypeId" required options={lts.map((l) => ({ value: l.id, label: l.name + (l.daysPerYear ? ` (${l.daysPerYear} วัน/ปี)` : "") }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ตั้งแต่วันที่">
                  <Input type="date" name="startDate" required defaultValue={today} />
                </Field>
                <Field label="ถึงวันที่">
                  <Input type="date" name="endDate" required defaultValue={today} />
                </Field>
              </div>
              <Checkbox name="halfDay" label="ลาครึ่งวัน (เฉพาะลาวันเดียว)" />
              <Field label="เหตุผล">
                <Textarea name="reason" />
              </Field>
              <p className="text-xs text-stone-400">ระบบนับเฉพาะวันทำงานตามกะของคุณ ไม่รวมวันหยุด</p>
            </>
          )}
          {type === "ot" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="วันที่ทำ OT">
                  <Input type="date" name="otDate" required defaultValue={today} />
                </Field>
                <Field label="จำนวนชั่วโมง">
                  <Input type="number" name="otHours" step="0.5" min={0.5} max={16} required defaultValue={2} />
                </Field>
              </div>
              <Field label="อัตรา">
                <Select
                  name="otRate"
                  defaultValue="1.5"
                  options={[
                    { value: "1.5", label: "1.5 เท่า — ทำงานล่วงเวลาวันทำงานปกติ" },
                    { value: "1.0", label: "1 เท่า — ทำงานในวันหยุด (พนักงานรายเดือน)" },
                    { value: "2.0", label: "2 เท่า — ทำงานในวันหยุด (พนักงานรายวัน)" },
                    { value: "3.0", label: "3 เท่า — ล่วงเวลาในวันหยุด" },
                  ]}
                />
              </Field>
              <Field label="งานที่ทำ">
                <Textarea name="reason" required />
              </Field>
            </>
          )}
          {type === "time_correction" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Field label="ประเภท">
                  <Select
                    name="correctionType"
                    defaultValue={sp.kind === "out" ? "out" : "in"}
                    options={[
                      { value: "in", label: "เวลาเข้า" },
                      { value: "out", label: "เวลาออก" },
                    ]}
                  />
                </Field>
                <Field label="วันที่">
                  <Input type="date" name="date" required defaultValue={/^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") && sp.date! <= today ? sp.date : today} max={today} />
                </Field>
                <Field label="เวลา">
                  <Input type="time" name="time" required />
                </Field>
              </div>
              <Field label="เหตุผล">
                <Textarea name="reason" required placeholder="เช่น ลืมสแกนนิ้วตอนเข้างาน" />
              </Field>
            </>
          )}
          <SubmitButton>ส่งคำขอ</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
