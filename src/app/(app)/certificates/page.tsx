import { desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { certificateRequests, departments, employees, positions } from "@/db/schema";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Flash, Input, PageHeader, Select, Table } from "@/components/ui";
import { isHR, requireUser } from "@/lib/auth";
import { CERT_LABEL } from "@/lib/certificate";
import { fmtDateTime } from "@/lib/time";
import { getSettings } from "@/lib/payroll-run";
import { cn, fullName, REQUEST_STATUS_LABEL } from "@/lib/util";
import { CertificateBody } from "./certificate-body";
import { cancelCertificate, decideCertificate, requestCertificate } from "./actions";

export const metadata = { title: "หนังสือรับรอง" };

const TONE = { pending: "amber", approved: "green", rejected: "red", cancelled: "gray" } as const;

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; preview?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const hr = isHR(u);
  const [mine, all] = await Promise.all([
    u.employeeId ? db.select().from(certificateRequests).where(eq(certificateRequests.employeeId, u.employeeId)).orderBy(desc(certificateRequests.createdAt)) : [],
    hr
      ? db
          .select({ c: certificateRequests, e: employees })
          .from(certificateRequests)
          .innerJoin(employees, eq(certificateRequests.employeeId, employees.id))
          .where(ne(certificateRequests.status, "cancelled"))
          .orderBy(desc(certificateRequests.createdAt))
          .limit(100)
      : [],
  ]);
  const pending = all.filter((x) => x.c.status === "pending" && x.c.employeeId !== u.employeeId);
  // ตัวอย่างหนังสือด้วยข้อมูลจริงของผู้ใช้ (สลับประเภทด้วย ?preview=)
  const previewKind = sp.preview === "salary" ? "salary" : "employment";
  const [me] = u.employeeId
    ? await db
        .select({ e: employees, pos: positions.name, dept: departments.name })
        .from(employees)
        .leftJoin(positions, eq(employees.positionId, positions.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .where(eq(employees.id, u.employeeId))
    : [];
  const company = await getSettings();

  return (
    <>
      <PageHeader title="หนังสือรับรอง" subtitle="ขอหนังสือรับรองการทำงาน / รับรองเงินเดือน — ฝ่ายบุคคลอนุมัติแล้วพิมพ์หรือบันทึกเป็น PDF ได้ทันที" />
      <Flash ok={sp.ok} error={sp.error} />

      {hr && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-brand-900">รอออกหนังสือ {pending.length} รายการ</h2>
          {pending.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-brand-200 bg-white p-6 text-center text-sm text-stone-500">ไม่มีคำขอที่รออยู่</p>
          ) : (
            <div className="space-y-3">
              {pending.map(({ c, e }) => (
                <div key={c.id} className="rounded-3xl border border-brand-200/80 bg-white p-4 shadow-card sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{CERT_LABEL[c.kind]}</Badge>
                    <span className="font-semibold text-brand-900">{fullName(e)}</span>
                    <span className="text-xs text-stone-400">{e.code}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-stone-600">
                    เพื่อ {c.purpose} · {c.copies} ฉบับ · ยื่นเมื่อ {fmtDateTime(c.createdAt)}
                  </p>
                  {c.kind === "salary" && <p className="mt-1 text-xs text-amber-700">หนังสือรับรองเงินเดือนจะแสดงอัตราเงินเดือนปัจจุบันจากข้อมูลพนักงาน — ตรวจให้ถูกต้องก่อนอนุมัติ</p>}
                  <form action={decideCertificate} className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <Input name="note" placeholder="หมายเหตุ (ถ้ามี)" className="max-w-xs min-w-48 flex-1" />
                    <SubmitButton name="decision" value="approved" variant="success">
                      ออกหนังสือ
                    </SubmitButton>
                    <SubmitButton name="decision" value="rejected" variant="secondary" confirm="ยืนยันไม่อนุมัติ?">
                      ไม่อนุมัติ
                    </SubmitButton>
                    <Link href={`/certificates/${c.id}`} className="inline-flex items-center gap-1 px-2 text-sm font-medium text-brand-700 hover:text-brand-900">
                      <Icon name="document" className="size-4" /> ดูตัวอย่างหนังสือ
                    </Link>
                  </form>
                </div>
              ))}
            </div>
          )}

          <h3 className="mt-6 mb-2 text-sm font-semibold text-brand-800">ที่ออกไปแล้ว</h3>
          <Table head={["เลขที่", "พนักงาน", "เอกสาร", "เพื่อ", "สถานะ", ""]} empty={!all.some((x) => x.c.status !== "pending")}>
            {all
              .filter((x) => x.c.status !== "pending")
              .map(({ c, e }) => (
                <tr key={c.id} data-href={c.status === "approved" ? `/certificates/${c.id}` : undefined}>
                  <td className="whitespace-nowrap tabular-nums">{c.docNo ?? "-"}</td>
                  <td>{fullName(e)}</td>
                  <td>{CERT_LABEL[c.kind]}</td>
                  <td className="text-stone-500">{c.purpose}</td>
                  <td>
                    <Badge tone={TONE[c.status]}>{c.status === "approved" ? "ออกแล้ว" : REQUEST_STATUS_LABEL[c.status]}</Badge>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {c.status === "approved" && (
                      <Link href={`/certificates/${c.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                        <Icon name="printer" className="size-4" /> เปิด / พิมพ์
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
          </Table>
        </section>
      )}

      {u.employeeId && (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Card title="ขอหนังสือรับรอง">
            <form action={requestCertificate} className="space-y-3">
              <Field label="ประเภท">
                <Select
                  name="kind"
                  options={[
                    { value: "employment", label: CERT_LABEL.employment },
                    { value: "salary", label: `${CERT_LABEL.salary} (มีอัตราเงินเดือน)` },
                  ]}
                />
              </Field>
              <Field label="นำไปใช้เพื่อ">
                <Input name="purpose" required placeholder="เช่น ยื่นขอสินเชื่อบ้าน, ยื่นวีซ่า" />
              </Field>
              <Field label="จำนวน (ฉบับ)">
                <Input name="copies" type="number" min={1} max={5} defaultValue={1} />
              </Field>
              <SubmitButton>ส่งคำขอ</SubmitButton>
            </form>
          </Card>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-brand-800">คำขอของฉัน</h2>
            <Table head={["ยื่นเมื่อ", "เอกสาร", "เพื่อ", "สถานะ", ""]} empty={!mine.length}>
              {mine.map((c) => (
                <tr key={c.id} data-href={c.status === "approved" ? `/certificates/${c.id}` : undefined}>
                  <td className="whitespace-nowrap text-stone-500">{fmtDateTime(c.createdAt)}</td>
                  <td>{CERT_LABEL[c.kind]}</td>
                  <td className="text-stone-500">{c.purpose}</td>
                  <td>
                    <Badge tone={TONE[c.status]}>{c.status === "approved" ? "พร้อมพิมพ์" : REQUEST_STATUS_LABEL[c.status]}</Badge>
                    {c.decisionNote && <div className="text-xs text-stone-400">{c.decisionNote}</div>}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {c.status === "approved" && (
                      <Link href={`/certificates/${c.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                        <Icon name="printer" className="size-4" /> เปิด / พิมพ์
                      </Link>
                    )}
                    {c.status === "pending" && (
                      <form action={cancelCertificate}>
                        <input type="hidden" name="id" value={c.id} />
                        <SubmitButton variant="ghost" confirm="ยกเลิกคำขอนี้?">
                          ยกเลิก
                        </SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}

      {me && (
        <section id="preview" className="mt-6 scroll-mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-brand-900">ตัวอย่างหนังสือ</h2>
              <p className="text-sm text-stone-500">หน้าตาหนังสือที่จะได้รับ ใช้ข้อมูลของคุณที่มีในระบบ — ช่องสีแดง = ข้อมูลยังไม่ครบ แจ้งฝ่ายบุคคลก่อนขอ</p>
            </div>
            <div className="flex gap-1.5">
              {(["employment", "salary"] as const).map((k) => (
                <Link
                  key={k}
                  href={`?preview=${k}#preview`}
                  scroll={false}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm whitespace-nowrap transition",
                    previewKind === k ? "bg-brand-900 font-medium text-white" : "border border-brand-200 bg-white text-stone-600 hover:text-brand-900",
                  )}
                >
                  {k === "employment" ? "รับรองการทำงาน" : "รับรองเงินเดือน"}
                </Link>
              ))}
            </div>
          </div>
          <CertificateBody company={company} e={me.e} pos={me.pos} dept={me.dept} kind={previewKind} purpose={null} docNo={null} issued={new Date()} preview="ตัวอย่าง" />
        </section>
      )}
    </>
  );
}
