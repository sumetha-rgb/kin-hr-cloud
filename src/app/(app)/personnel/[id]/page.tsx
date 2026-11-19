import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { employeePhotos, employees, users, webauthnCredentials } from "@/db/schema";
import { PhotoUploader } from "@/components/photo-uploader";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Checkbox, Field, Flash, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { fullName, ROLE_LABEL } from "@/lib/util";
import { removeCredential, saveAccount } from "../actions";
import { EmployeeForm } from "../employee-form";

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await requireRole("admin", "hr");
  const { id } = await params;
  const sp = await searchParams;
  const [e] = await db.select().from(employees).where(eq(employees.id, Number(id)));
  if (!e) notFound();
  const [[account], [photo]] = await Promise.all([
    db.select().from(users).where(eq(users.employeeId, e.id)),
    db.select({ at: employeePhotos.updatedAt }).from(employeePhotos).where(eq(employeePhotos.employeeId, e.id)),
  ]);
  const creds = account
    ? await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, account.id)).orderBy(desc(webauthnCredentials.createdAt))
    : [];
  const roleOptions = Object.entries(ROLE_LABEL)
    .filter(([r]) => r !== "admin" || me.role === "admin")
    .map(([value, label]) => ({ value, label }));

  return (
    <>
      <PageHeader
        title={fullName(e)}
        subtitle={`รหัส ${e.code}`}
        actions={<LinkButton href={`/attendance/me?employee=${e.id}`} variant="secondary">ดูเวลาทำงาน</LinkButton>}
      />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <EmployeeForm employee={e} />
        <div className="space-y-5">
          <Card title="รูปโปรไฟล์" subtitle="พนักงานเปลี่ยนเองได้ที่หน้าโปรไฟล์">
            <PhotoUploader employeeId={e.id} name={fullName(e)} version={photo?.at.getTime() ?? null} back={`/personnel/${e.id}`} />
          </Card>
          <Card title="บัญชีเข้าใช้งาน">
            <form action={saveAccount} className="space-y-3">
              <input type="hidden" name="employeeId" value={e.id} />
              <Field label="ชื่อผู้ใช้">
                <Input name="username" required autoCapitalize="none" defaultValue={account?.username ?? e.code.toLowerCase()} />
              </Field>
              <Field label="สิทธิ์">
                <Select name="role" defaultValue={account?.role ?? "employee"} options={roleOptions} />
              </Field>
              <Field label={account ? "ตั้งรหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น"} hint={account ? "เว้นว่างถ้าไม่ต้องการเปลี่ยน" : "อย่างน้อย 8 ตัวอักษร"}>
                <Input name="password" type="password" autoComplete="new-password" minLength={8} required={!account} />
              </Field>
              <Checkbox name="active" label="เปิดใช้งานบัญชี" defaultChecked={account?.active ?? true} />
              {account?.lastLoginAt && <p className="text-xs text-stone-400">เข้าระบบล่าสุด {fmtDateTime(account.lastLoginAt)}</p>}
              <div>
                <SubmitButton>{account ? "บันทึกบัญชี" : "สร้างบัญชี"}</SubmitButton>
              </div>
            </form>
          </Card>

          <Card title="อุปกรณ์สแกนนิ้ว">
            {!account ? (
              <p className="text-sm text-stone-500">สร้างบัญชีก่อน แล้วให้พนักงานเข้าสู่ระบบบนมือถือเพื่อลงทะเบียนลายนิ้วมือ</p>
            ) : creds.length === 0 ? (
              <p className="text-sm text-stone-500">ยังไม่ได้ลงทะเบียน — ให้พนักงานเปิดเมนู “สแกนนิ้วลงเวลา” บนมือถือของตนเอง</p>
            ) : (
              <ul className="space-y-3">
                {creds.map((c) => (
                  <li key={c.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.deviceName || "อุปกรณ์"}</span>
                      <Badge tone="green">ใช้งานได้</Badge>
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      ลงทะเบียน {fmtDateTime(c.createdAt)}
                      <br />
                      ใช้ล่าสุด {fmtDateTime(c.lastUsedAt)}
                    </div>
                    <form action={removeCredential} className="mt-2">
                      <input type="hidden" name="employeeId" value={e.id} />
                      <input type="hidden" name="credentialId" value={c.id} />
                      <SubmitButton variant="secondary" confirm="ลบอุปกรณ์นี้? พนักงานต้องลงทะเบียนเครื่องใหม่ก่อนลงเวลา">
                        ลบ / รีเซ็ตอุปกรณ์
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-stone-400">
              ระบบเก็บเฉพาะ public key ของอุปกรณ์ ไม่มีภาพหรือข้อมูลลายนิ้วมือถูกส่งออกจากมือถือ — พนักงานลงทะเบียนได้ 1 เครื่อง หากเปลี่ยนมือถือ HR ต้องรีเซ็ตที่นี่
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
