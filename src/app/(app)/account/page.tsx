import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { webauthnCredentials } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Flash, Input, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { ROLE_LABEL } from "@/lib/util";
import { changePassword } from "./actions";

export const metadata = { title: "บัญชีของฉัน" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const creds = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, u.id));
  return (
    <>
      <PageHeader title="บัญชีของฉัน" subtitle={`${u.username} · ${ROLE_LABEL[u.role]}`} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        <Card title="เปลี่ยนรหัสผ่าน">
          <form action={changePassword} className="space-y-3">
            <Field label="รหัสผ่านปัจจุบัน">
              <Input name="current" type="password" autoComplete="current-password" required />
            </Field>
            <Field label="รหัสผ่านใหม่">
              <Input name="next" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="ยืนยันรหัสผ่านใหม่">
              <Input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <SubmitButton>บันทึก</SubmitButton>
          </form>
        </Card>
        {u.employeeId && (
          <Card title="อุปกรณ์สแกนนิ้ว">
            {creds.length === 0 ? (
              <p className="text-sm text-stone-500">
                ยังไม่ได้ลงทะเบียน —{" "}
                <Link href="/checkin" className="text-brand-600 underline">
                  ลงทะเบียนบนมือถือ
                </Link>
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {creds.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
                    <span>
                      {c.deviceName}
                      <span className="block text-xs text-stone-400">ใช้ล่าสุด {fmtDateTime(c.lastUsedAt)}</span>
                    </span>
                    <Badge tone="green">ใช้งานได้</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-stone-400">หากเปลี่ยนมือถือ กรุณาแจ้ง HR เพื่อรีเซ็ตอุปกรณ์ก่อนลงทะเบียนเครื่องใหม่</p>
          </Card>
        )}
      </div>
    </>
  );
}
