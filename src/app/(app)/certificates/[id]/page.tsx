import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { certificateRequests, departments, employees, positions, users } from "@/db/schema";
import { Icon } from "@/components/icons";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";
import { Flash, Input } from "@/components/ui";
import { isHR, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/payroll-run";
import { fmtDateTime } from "@/lib/time";
import { fullName } from "@/lib/util";
import { decideCertificate } from "../actions";
import { CertificateBody } from "../certificate-body";

export const metadata = { title: "หนังสือรับรอง" };

export default async function CertificateDoc({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const signer = alias(employees, "signer");
  const [row] = await db
    .select({ c: certificateRequests, e: employees, pos: positions.name, dept: departments.name, signer })
    .from(certificateRequests)
    .innerJoin(employees, eq(certificateRequests.employeeId, employees.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(users, eq(certificateRequests.decidedBy, users.id))
    .leftJoin(signer, eq(users.employeeId, signer.id))
    .where(eq(certificateRequests.id, id));
  const hr = isHR(u);
  // ฉบับจริง: อนุมัติแล้ว (HR / เจ้าของ) · ตัวอย่างก่อนอนุมัติ: HR เท่านั้น
  const pendingPreview = row?.c.status === "pending" && hr;
  if (!row || (row.c.status !== "approved" && !pendingPreview) || (!hr && row.c.employeeId !== u.employeeId)) notFound();
  const { c, e } = row;
  // ฉบับที่ออกแล้วใช้ข้อมูล ณ วันออก · ตัวอย่างก่อนอนุมัติใช้ข้อมูลปัจจุบัน
  const snap = c.status === "approved" ? c.snapshot : null;
  const [company, sp] = await Promise.all([getSettings(), searchParams]);

  return (
    <div className="mx-auto max-w-[210mm]">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href="/certificates" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
          <Icon name="chevronLeft" className="size-4" />
          หนังสือรับรอง
        </Link>
        {!pendingPreview && <PrintButton />}
      </div>
      <div className="no-print">
        <Flash ok={sp.ok} error={sp.error} />
      </div>

      {pendingPreview && (
        <div className="no-print mb-4 rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="font-medium text-brand-900">ตัวอย่างก่อนออกหนังสือ — ตรวจข้อมูลให้ถูกต้อง</p>
          <p className="text-sm text-stone-600">
            {fullName(e)} ขอเมื่อ {fmtDateTime(c.createdAt)} · {c.copies} ฉบับ · ช่องสีแดง = ข้อมูลพนักงานยังไม่ครบ (แก้ที่{" "}
            <Link href={`/personnel/${e.id}`} className="font-medium text-brand-700 underline underline-offset-4">
              หน้าพนักงาน
            </Link>
            )
          </p>
          <form action={decideCertificate} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={c.id} />
            <Input name="note" placeholder="หมายเหตุ (ถ้ามี)" className="max-w-xs min-w-48 flex-1" />
            <SubmitButton name="decision" value="approved" variant="success">
              ออกหนังสือ
            </SubmitButton>
            <SubmitButton name="decision" value="rejected" variant="secondary" confirm="ยืนยันไม่อนุมัติ?">
              ไม่อนุมัติ
            </SubmitButton>
          </form>
        </div>
      )}

      <CertificateBody
        company={snap?.company ?? company}
        e={snap?.e ?? e}
        pos={snap ? snap.pos : row.pos}
        dept={snap ? snap.dept : row.dept}
        kind={c.kind}
        purpose={c.purpose}
        docNo={c.docNo}
        issued={c.decidedAt ?? new Date()}
        signerName={snap ? (snap.signerName ?? undefined) : row.signer ? fullName(row.signer) : pendingPreview ? (u.displayName ?? undefined) : undefined}
        preview={pendingPreview ? "ตัวอย่าง" : undefined}
      />
    </div>
  );
}
